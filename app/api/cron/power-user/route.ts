/**
 * /api/cron/power-user — Schedule diário 14:00 UTC.
 *
 * Lifecycle email — dispara `radar.power_user` pra users com engajamento
 * alto. Critério (proxy via saved_items, que é a melhor sinal de ação no
 * dashboard que temos persistido por user/data):
 *
 *   - last_login_at nas últimas 24h (user voltou hoje)
 *   E uma das duas:
 *     a) saved_items em 7+ dias distintos nos últimos 14 dias  (proxy "7 dias seguidos abrindo"),
 *     b) >= 20 saved_items nos últimos 30 dias                 (proxy "20+ acessos ao dashboard").
 *
 * Não temos session log per-day, então saved_items é o evento mais próximo
 * de "user usou o produto nesse dia". Quando rolar logging de page_view
 * server-side, trocar a query.
 *
 * Idempotência: `last_power_user_email_at` impõe cooldown de 30 dias —
 * power-user é elogio, não vale repetir todo mês.
 *
 * Auth + flag: igual aos outros crons.
 */

import {
  checkCronAuth,
  isCronEnabled,
  getCronSql,
  logCronRun,
  jsonResponse,
} from "@/lib/cron-utils";
import { fireResendEvent } from "@/lib/resend";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const maxDuration = 120;

type SqlClient = NeonQueryFunction<false, false>;

interface PowerUserRow {
  user_id: string;
  email: string;
  niche_slug: string | null;
  distinct_days_14d: number;
  saves_30d: number;
}

const DASHBOARD_URL =
  process.env.RADAR_DASHBOARD_URL ?? "https://radar.kaleidos.com.br/dashboard";

async function listPowerUsers(sql: SqlClient): Promise<PowerUserRow[]> {
  const rows = (await sql`
    WITH activity AS (
      SELECT user_id,
             COUNT(DISTINCT date_trunc('day', saved_at))::int AS distinct_days_14d,
             0 AS saves_30d
        FROM saved_items
       WHERE saved_at >= NOW() - INTERVAL '14 days'
       GROUP BY user_id
    ),
    saves_month AS (
      SELECT user_id, COUNT(*)::int AS saves_30d
        FROM saved_items
       WHERE saved_at >= NOW() - INTERVAL '30 days'
       GROUP BY user_id
    )
    SELECT p.auth_user_id AS user_id,
           p.email,
           (SELECT slug FROM user_niches un
              WHERE un.user_id = p.auth_user_id AND un.is_active = TRUE
              LIMIT 1) AS niche_slug,
           COALESCE(a.distinct_days_14d, 0) AS distinct_days_14d,
           COALESCE(sm.saves_30d, 0) AS saves_30d
      FROM user_profiles p
      LEFT JOIN activity a    ON a.user_id  = p.auth_user_id
      LEFT JOIN saves_month sm ON sm.user_id = p.auth_user_id
     WHERE p.email IS NOT NULL
       AND p.email <> ''
       AND p.last_login_at IS NOT NULL
       AND p.last_login_at >= NOW() - INTERVAL '24 hours'
       AND (
            COALESCE(a.distinct_days_14d, 0) >= 7
         OR COALESCE(sm.saves_30d, 0) >= 20
       )
       AND (p.last_power_user_email_at IS NULL
            OR p.last_power_user_email_at < NOW() - INTERVAL '30 days')
  `) as Array<PowerUserRow>;
  return rows;
}

export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.reason ?? "Unauthorized" }, { status: 401 });
  }

  if (!isCronEnabled()) {
    return jsonResponse({
      ok: true,
      skipped: "RADAR_V2_CRON_ENABLED não setado",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const t0 = Date.now();
  const users = await listPowerUsers(sql);

  if (auth.isDry) {
    return jsonResponse({
      ok: true,
      dry: true,
      eligible_users: users.length,
      sample: users.slice(0, 5).map((u) => ({
        user_id: u.user_id,
        distinct_days_14d: u.distinct_days_14d,
        saves_30d: u.saves_30d,
      })),
      duration_ms: Date.now() - t0,
    });
  }

  let dispatched = 0;
  let errors = 0;

  for (const user of users) {
    try {
      await fireResendEvent("radar.power_user", {
        email: user.email,
        user_id: user.user_id,
        nicho: user.niche_slug ?? "marketing",
        distinct_days_14d: user.distinct_days_14d,
        saves_30d: user.saves_30d,
        dashboard_url: DASHBOARD_URL,
      });
      await sql`
        UPDATE user_profiles
           SET last_power_user_email_at = NOW()
         WHERE auth_user_id = ${user.user_id}
      `;
      dispatched++;
    } catch (err) {
      errors++;
      console.warn(
        `[power-user] user=${user.user_id} falhou:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  await logCronRun(sql, {
    cronType: "power-user",
    postsAdded: dispatched,
    status: errors > 0 && dispatched === 0 ? "error" : "success",
    errorMsg: errors > 0 ? `${errors} disparos falharam` : undefined,
  });

  return jsonResponse({
    ok: true,
    eligible: users.length,
    dispatched,
    errors,
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
