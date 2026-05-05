/**
 * /api/cron/weekly-digest — Schedule semanal segunda 10:00 UTC (07:00 BRT).
 *
 * Lifecycle email — dispara o event Resend `radar.weekly` pra cada user com
 * niche configurado e pelo menos 5 trends da semana passada.
 *
 * Pipeline:
 *  1. Para cada user em `user_profiles` com row em `user_niches.is_active=TRUE`
 *  2. Pega top 5 posts de `instagram_posts` do nicho com `posted_at` nos
 *     últimos 7 dias, ordem `likes DESC NULLS LAST`. Mesma fonte de "trends"
 *     que o dashboard mostra (`/api/data/instagram/posts?sort=top&hours=168`).
 *  3. Se < 5 posts, pula esse user (digest pobre não vai)
 *  4. fireResendEvent('radar.weekly', { ...vars do template })
 *  5. Marca `user_profiles.last_weekly_digest_at = NOW()` pra rastreio
 *
 * Auth + flag: igual aos outros crons (CRON_SECRET / x-vercel-cron / RADAR_V2_CRON_ENABLED).
 *
 * Idempotência: o cron roda 1x por semana (segunda). Se rerodar no mesmo
 * dia, `last_weekly_digest_at >= today_start` filtra disparos repetidos.
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
export const maxDuration = 300;

type SqlClient = NeonQueryFunction<false, false>;

interface UserRow {
  user_id: string;
  email: string;
  niche_slug: string;
  niche_label: string;
}

interface TrendRow {
  shortcode: string;
  account_handle: string;
  caption: string | null;
  likes: number | null;
  views: number | null;
  comments: number | null;
}

const DASHBOARD_URL =
  process.env.RADAR_DASHBOARD_URL ?? "https://radar.kaleidos.com.br/dashboard";

function formatNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

function trendMetric(row: TrendRow): string {
  const v = row.views ?? 0;
  const l = row.likes ?? 0;
  if (v >= 1_000) return `${formatNumber(v)} views`;
  if (l > 0) return `${formatNumber(l)} likes`;
  return `${formatNumber(row.comments ?? 0)} comments`;
}

function trendTitle(row: TrendRow): string {
  const cap = (row.caption ?? "").trim();
  // Primeira frase ou primeiros 80 chars — caption do IG já vem só texto.
  const firstLine = cap.split(/\n|\r/)[0] ?? "";
  const trimmed = firstLine.length > 0 ? firstLine : `@${row.account_handle}`;
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

function trendDesc(row: TrendRow): string {
  const cap = (row.caption ?? "").trim();
  if (!cap) return `Post de @${row.account_handle} bombando essa semana.`;
  return cap.length > 220 ? `${cap.slice(0, 217)}…` : cap;
}

function trendUrl(row: TrendRow): string {
  return `https://www.instagram.com/p/${row.shortcode}/`;
}

function formatWeekRange(end: Date): string {
  const start = new Date(end.getTime() - 6 * 24 * 3_600_000);
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `Semana de ${fmt(start)} a ${fmt(end)}`;
}

async function listEligibleUsers(sql: SqlClient): Promise<UserRow[]> {
  // Pega users com niche ativo. user_niches é canônica da v1.
  // user_profiles.email vem do signup (Better Auth populou via trigger).
  const rows = (await sql`
    SELECT p.auth_user_id AS user_id,
           p.email,
           un.slug AS niche_slug,
           COALESCE(un.label, un.slug) AS niche_label
      FROM user_profiles p
      JOIN user_niches un ON un.user_id = p.auth_user_id AND un.is_active = TRUE
     WHERE p.email IS NOT NULL
       AND p.email <> ''
       AND (p.last_weekly_digest_at IS NULL
            OR p.last_weekly_digest_at < CURRENT_DATE)
  `) as Array<UserRow>;
  // Dedup user_id (caso tenha múltiplos niches ativos — pega o primeiro).
  const seen = new Set<string>();
  const out: UserRow[] = [];
  for (const r of rows) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    out.push(r);
  }
  return out;
}

async function topTrends(
  sql: SqlClient,
  nicheSlug: string,
): Promise<TrendRow[]> {
  // Mesma query que /api/data/instagram/posts?sort=top&hours=168 usa.
  // Janela 7 dias, ordenado por likes desc — define "top trend da semana".
  const rows = (await sql`
    SELECT shortcode, account_handle, caption, likes, views, comments
      FROM instagram_posts
     WHERE niche = ${nicheSlug}
       AND posted_at >= NOW() - INTERVAL '7 days'
       AND COALESCE(likes, 0) > 0
     ORDER BY likes DESC NULLS LAST
     LIMIT 5
  `) as Array<TrendRow>;
  return rows;
}

type DigestPayload = Record<string, string>;

function buildPayload(user: UserRow, trends: TrendRow[]): DigestPayload {
  const semana = formatWeekRange(new Date());
  const payload: DigestPayload = {
    email: user.email,
    user_id: user.user_id,
    semana,
    nicho: user.niche_label,
    dashboard_url: DASHBOARD_URL,
  };
  for (let i = 0; i < 5; i++) {
    const t = trends[i];
    const idx = i + 1;
    payload[`trend_${idx}_title`] = trendTitle(t);
    payload[`trend_${idx}_desc`] = trendDesc(t);
    payload[`trend_${idx}_url`] = trendUrl(t);
    payload[`trend_${idx}_metric`] = trendMetric(t);
  }
  return payload;
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
  const users = await listEligibleUsers(sql);

  if (auth.isDry) {
    // Dry: mostra users elegíveis e contagem de trends por nicho sem disparar.
    const niches = Array.from(new Set(users.map((u) => u.niche_slug)));
    const trendsCount = await Promise.all(
      niches.map(async (n) => {
        const t = await topTrends(sql, n);
        return { niche: n, count: t.length };
      }),
    );
    return jsonResponse({
      ok: true,
      dry: true,
      eligible_users: users.length,
      niches: trendsCount,
      duration_ms: Date.now() - t0,
    });
  }

  let dispatched = 0;
  let skipped_no_trends = 0;
  let errors = 0;

  // Cache de trends por nicho — evita N queries se vários users têm mesmo niche.
  const trendsByNiche = new Map<string, TrendRow[]>();
  async function getTrends(nicheSlug: string): Promise<TrendRow[]> {
    if (trendsByNiche.has(nicheSlug)) return trendsByNiche.get(nicheSlug)!;
    const t = await topTrends(sql, nicheSlug);
    trendsByNiche.set(nicheSlug, t);
    return t;
  }

  for (const user of users) {
    try {
      const trends = await getTrends(user.niche_slug);
      if (trends.length < 5) {
        skipped_no_trends++;
        continue;
      }
      const payload = buildPayload(user, trends);
      await fireResendEvent("radar.weekly", payload);
      await sql`
        UPDATE user_profiles
           SET last_weekly_digest_at = NOW()
         WHERE auth_user_id = ${user.user_id}
      `;
      dispatched++;
    } catch (err) {
      errors++;
      console.warn(
        `[weekly-digest] user=${user.user_id} falhou:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  await logCronRun(sql, {
    cronType: "weekly-digest",
    postsAdded: dispatched,
    status: errors > 0 && dispatched === 0 ? "error" : "success",
    errorMsg: errors > 0 ? `${errors} disparos falharam` : undefined,
  });

  return jsonResponse({
    ok: true,
    eligible: users.length,
    dispatched,
    skipped_no_trends,
    errors,
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
