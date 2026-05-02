/**
 * GET /api/admin/stats — payload completo do admin Radar Viral v2.
 *
 * Retorna em uma única chamada:
 *  - summary: users, subs, posts coletados, briefs, custos 30d
 *  - planCounts: free vs pro
 *  - dailySeries 30d: posts coletados/dia + briefs/dia + custos/dia
 *  - sources: tracked_sources breakdown por platform/niche/global vs user
 *  - users: top 50 com profile/sub/saved/briefs
 *  - subscriptions: lista Pro + MRR
 *  - cronRuns: últimos 50 runs (status, posts adicionados)
 *
 * Auth: requireAdmin.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/admin";
import { PLANS_RDV } from "@/lib/pricing";

export const runtime = "nodejs";
// Cache 60s — admin dashboard refresh frequente não justifica rodar 14
// queries pesadas todo request. ISR de 1min é amplo o bastante pra ver
// movimentação real e barato o bastante pra Neon.
export const revalidate = 60;

const dbUrl = process.env.DATABASE_URL;

interface NumRow { n: number }
interface FloatRow { n: number }
interface PlanCountRow { plan: string; n: number }
interface DailyRow {
  day: string;
  ig_posts: number;
  yt_videos: number;
  news: number;
  newsletters: number;
  briefs: number;
  cost: number;
}
interface SourceBreakdownRow {
  platform: string;
  niche: string;
  total: number;
  active: number;
  per_user: number;
  global: number;
}
interface AdminUserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  status: string | null;
  last_login_at: string | null;
  niche: string | null;
  saved_count: number;
  plan: string | null;
  sub_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}
interface SubscriptionRow {
  user_id: string;
  email: string | null;
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}
interface CronRunRow {
  id: number;
  user_id: string | null;
  cron_type: string;
  niche_id: number | null;
  posts_added: number | null;
  status: string;
  error_msg: string | null;
  ran_at: string;
}

export async function GET(req: Request) {
  if (!dbUrl) {
    return NextResponse.json({ error: "DB não configurado" }, { status: 503 });
  }
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;

  const sql = neon(dbUrl);

  // ── Summary ──────────────────────────────────────────────────────────
  const [
    totalUsersRow,
    totalProfilesRow,
    activeSubsRow,
    totalIgRow,
    totalYtRow,
    totalNewsRow,
    totalNlRow,
    posts30dRow,
    videos30dRow,
    news30dRow,
    nl30dRow,
    briefs30dRow,
    costGemini30dRow,
    costApify30dRow,
    cronRuns30dRow,
  ] = (await Promise.all([
    sql`SELECT COUNT(DISTINCT user_id)::int AS n FROM saved_items WHERE user_id IS NOT NULL`,
    sql`SELECT COUNT(*)::int AS n FROM user_profiles`,
    sql`SELECT COUNT(*)::int AS n FROM user_subscriptions_radar WHERE status='active' AND plan IN ('pro','max')`,
    sql`SELECT COUNT(*)::int AS n FROM instagram_posts`,
    sql`SELECT COUNT(*)::int AS n FROM videos`,
    sql`SELECT COUNT(*)::int AS n FROM news_articles`,
    sql`SELECT COUNT(*)::int AS n FROM newsletter_articles`,
    sql`SELECT COUNT(*)::int AS n FROM instagram_posts WHERE scraped_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COUNT(*)::int AS n FROM videos WHERE first_seen_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COUNT(*)::int AS n FROM news_articles WHERE fetched_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COUNT(*)::int AS n FROM newsletter_articles WHERE fetched_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COUNT(*)::int AS n FROM daily_briefs WHERE generated_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COALESCE(SUM(cost_usd), 0)::float AS n FROM ai_usage_log WHERE created_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COALESCE(SUM(cost_usd), 0)::float AS n FROM instagram_scrape_runs WHERE ran_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COUNT(*)::int AS n FROM cron_run_log WHERE ran_at >= NOW() - INTERVAL '30 days'`,
  ])) as unknown as [
    NumRow[], NumRow[], NumRow[], NumRow[], NumRow[], NumRow[], NumRow[],
    NumRow[], NumRow[], NumRow[], NumRow[], NumRow[],
    FloatRow[], FloatRow[], NumRow[],
  ];

  const totalCost30d = (costGemini30dRow[0]?.n ?? 0) + (costApify30dRow[0]?.n ?? 0);

  // ── Plan counts ─────────────────────────────────────────────────────
  const planCountsRows = (await sql`
    SELECT plan, COUNT(*)::int AS n
      FROM user_subscriptions_radar
     WHERE status = 'active'
     GROUP BY plan
  `) as PlanCountRow[];
  const planCounts: Record<string, number> = { free: 0, pro: 0, max: 0 };
  for (const r of planCountsRows) {
    planCounts[r.plan] = r.n;
  }

  // ── Daily series 30d ────────────────────────────────────────────────
  const dailyRows = (await sql`
    WITH days AS (
      SELECT (CURRENT_DATE - i)::date AS day
        FROM generate_series(0, 29) AS i
    ),
    ig AS (
      SELECT date_trunc('day', scraped_at)::date AS day, COUNT(*)::int AS n
        FROM instagram_posts
       WHERE scraped_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY 1
    ),
    yt AS (
      SELECT date_trunc('day', first_seen_at)::date AS day, COUNT(*)::int AS n
        FROM videos
       WHERE first_seen_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY 1
    ),
    news AS (
      SELECT date_trunc('day', fetched_at)::date AS day, COUNT(*)::int AS n
        FROM news_articles
       WHERE fetched_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY 1
    ),
    nl AS (
      SELECT date_trunc('day', fetched_at)::date AS day, COUNT(*)::int AS n
        FROM newsletter_articles
       WHERE fetched_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY 1
    ),
    briefs AS (
      SELECT date_trunc('day', generated_at)::date AS day, COUNT(*)::int AS n,
             COALESCE(SUM(cost_usd), 0)::float AS c
        FROM daily_briefs
       WHERE generated_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY 1
    ),
    apify AS (
      SELECT date_trunc('day', ran_at)::date AS day,
             COALESCE(SUM(cost_usd), 0)::float AS c
        FROM instagram_scrape_runs
       WHERE ran_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY 1
    )
    SELECT d.day::text AS day,
           COALESCE(ig.n, 0)::int AS ig_posts,
           COALESCE(yt.n, 0)::int AS yt_videos,
           COALESCE(news.n, 0)::int AS news,
           COALESCE(nl.n, 0)::int AS newsletters,
           COALESCE(briefs.n, 0)::int AS briefs,
           (COALESCE(briefs.c, 0) + COALESCE(apify.c, 0))::float AS cost
      FROM days d
      LEFT JOIN ig    ON ig.day    = d.day
      LEFT JOIN yt    ON yt.day    = d.day
      LEFT JOIN news  ON news.day  = d.day
      LEFT JOIN nl    ON nl.day    = d.day
      LEFT JOIN briefs ON briefs.day = d.day
      LEFT JOIN apify  ON apify.day  = d.day
     ORDER BY d.day ASC
  `) as DailyRow[];

  // ── Sources breakdown ──────────────────────────────────────────────
  const sourcesRows = (await sql`
    SELECT platform,
           niche,
           COUNT(*)::int AS total,
           SUM(CASE WHEN active THEN 1 ELSE 0 END)::int AS active,
           SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)::int AS per_user,
           SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END)::int AS global
      FROM tracked_sources
     GROUP BY platform, niche
     ORDER BY platform, niche
  `) as SourceBreakdownRow[];

  // ── Top users (top 50 por saved_items) ─────────────────────────────
  const usersRows = (await sql`
    SELECT p.auth_user_id AS user_id,
           p.email,
           p.display_name,
           p.role,
           p.status,
           p.last_login_at::text,
           (SELECT slug FROM user_niches un WHERE un.user_id = p.auth_user_id LIMIT 1) AS niche,
           (SELECT COUNT(*)::int FROM saved_items si WHERE si.user_id = p.auth_user_id) AS saved_count,
           sub.plan,
           sub.status AS sub_status,
           sub.current_period_end::text AS current_period_end,
           sub.stripe_customer_id
      FROM user_profiles p
      LEFT JOIN user_subscriptions_radar sub ON sub.user_id = p.auth_user_id
     ORDER BY p.last_login_at DESC NULLS LAST
     LIMIT 50
  `) as AdminUserRow[];

  // ── Subscriptions Pro ─────────────────────────────────────────────
  const subsRows = (await sql`
    SELECT s.user_id,
           p.email,
           s.plan,
           s.status,
           s.current_period_end::text,
           s.cancel_at_period_end,
           s.created_at::text
      FROM user_subscriptions_radar s
      LEFT JOIN user_profiles p ON p.auth_user_id = s.user_id
     WHERE s.plan IN ('pro', 'max')
     ORDER BY s.created_at DESC
     LIMIT 50
  `) as SubscriptionRow[];

  const activeSubs = subsRows.filter((s) => s.status === "active");
  const mrrCentsBrl = activeSubs.reduce((acc, s) => {
    const plan = s.plan as keyof typeof PLANS_RDV;
    return acc + (PLANS_RDV[plan]?.priceMonthly ?? 0);
  }, 0);

  // ── Cron runs ─────────────────────────────────────────────────────
  const cronRows = (await sql`
    SELECT id, user_id, cron_type, niche_id,
           posts_added, status, error_msg,
           ran_at::text
      FROM cron_run_log
     ORDER BY ran_at DESC
     LIMIT 50
  `) as CronRunRow[];

  return NextResponse.json({
    summary: {
      totalUsers: totalUsersRow[0]?.n ?? 0,
      totalProfiles: totalProfilesRow[0]?.n ?? 0,
      activeSubs: activeSubsRow[0]?.n ?? 0,
      totalIgPosts: totalIgRow[0]?.n ?? 0,
      totalVideos: totalYtRow[0]?.n ?? 0,
      totalNews: totalNewsRow[0]?.n ?? 0,
      totalNewsletters: totalNlRow[0]?.n ?? 0,
      ig30d: posts30dRow[0]?.n ?? 0,
      videos30d: videos30dRow[0]?.n ?? 0,
      news30d: news30dRow[0]?.n ?? 0,
      newsletters30d: nl30dRow[0]?.n ?? 0,
      briefs30d: briefs30dRow[0]?.n ?? 0,
      costGemini30d: costGemini30dRow[0]?.n ?? 0,
      costApify30d: costApify30dRow[0]?.n ?? 0,
      totalCost30d,
      cronRuns30d: cronRuns30dRow[0]?.n ?? 0,
    },
    planCounts,
    dailySeries: dailyRows,
    sources: sourcesRows,
    users: usersRows,
    subscriptions: {
      activeCount: activeSubs.length,
      mrrBrl: mrrCentsBrl / 100,
      mrrUsd: mrrCentsBrl / 100 / 5,
      list: subsRows,
    },
    cronRuns: cronRows,
    generatedAt: new Date().toISOString(),
  });
}
