/**
 * /api/cron/idle-5d — Schedule diário 13:00 UTC.
 *
 * Lifecycle email — dispara `radar.idle_5d` pra users que não logam há 5+
 * dias mas menos de 10 (evita spammar quem já largou de vez; nesse caso a
 * automação Resend assume um fluxo de win-back diferente).
 *
 * Critério de "logado":
 *   `user_profiles.last_login_at` BETWEEN NOW() - 10d AND NOW() - 5d.
 *
 * Idempotência:
 *   `last_idle_5d_email_at` impede re-disparo dentro de 14 dias (cooldown).
 *
 * Auth + flag: igual aos outros crons (CRON_SECRET / x-vercel-cron / RADAR_V2_CRON_ENABLED).
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

interface IdleUserRow {
  user_id: string;
  email: string;
  last_login_at: string | null;
  niche_slug: string | null;
}

const DASHBOARD_URL =
  process.env.RADAR_DASHBOARD_URL ?? "https://radar.kaleidos.com.br/dashboard";

async function listIdleUsers(sql: SqlClient): Promise<IdleUserRow[]> {
  const rows = (await sql`
    SELECT p.auth_user_id AS user_id,
           p.email,
           p.last_login_at::text AS last_login_at,
           (SELECT slug FROM user_niches un
              WHERE un.user_id = p.auth_user_id AND un.is_active = TRUE
              LIMIT 1) AS niche_slug
      FROM user_profiles p
     WHERE p.email IS NOT NULL
       AND p.email <> ''
       AND p.last_login_at IS NOT NULL
       AND p.last_login_at <= NOW() - INTERVAL '5 days'
       AND p.last_login_at >  NOW() - INTERVAL '10 days'
       AND (p.last_idle_5d_email_at IS NULL
            OR p.last_idle_5d_email_at < NOW() - INTERVAL '14 days')
  `) as Array<IdleUserRow>;
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
  const users = await listIdleUsers(sql);

  if (auth.isDry) {
    return jsonResponse({
      ok: true,
      dry: true,
      eligible_users: users.length,
      sample: users.slice(0, 5).map((u) => ({
        user_id: u.user_id,
        last_login_at: u.last_login_at,
      })),
      duration_ms: Date.now() - t0,
    });
  }

  let dispatched = 0;
  let errors = 0;

  for (const user of users) {
    try {
      await fireResendEvent("radar.idle_5d", {
        email: user.email,
        user_id: user.user_id,
        last_login_at: user.last_login_at,
        nicho: user.niche_slug ?? "marketing",
        dashboard_url: DASHBOARD_URL,
      });
      await sql`
        UPDATE user_profiles
           SET last_idle_5d_email_at = NOW()
         WHERE auth_user_id = ${user.user_id}
      `;
      dispatched++;
    } catch (err) {
      errors++;
      console.warn(
        `[idle-5d] user=${user.user_id} falhou:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  await logCronRun(sql, {
    cronType: "idle-5d",
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
