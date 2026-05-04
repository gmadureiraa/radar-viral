/**
 * /api/cron/scrape-tiktok — Schedule diário 11:00 UTC.
 *
 * Plano Max only. Apify actor `clockworks/tiktok-scraper` (~\$0.01/run).
 *
 * Pipeline:
 *  1. Lista users com plan='max' active
 *  2. Pra cada user, lista tracked_sources(platform='tiktok',active=true)
 *  3. Roda actor → upsert em tiktok_posts
 *
 * Migration tiktok_posts: cria IF NOT EXISTS no startup do handler.
 *
 * Auth + flag + dry-run idem refresh/brief.
 *
 * NOTA: a chamada Apify real está COMENTADA por padrão pra evitar custo
 * inadvertido até o actor estar configurado e os caps testados. Para
 * ativar:
 *  1. Confirmar conta Apify tem actor clockworks/tiktok-scraper instalado
 *  2. Descomentar o bloco `realApifyCall` abaixo
 *  3. Setar APIFY_API_KEY no Vercel
 */

import { checkCronAuth, isCronEnabled, getCronSql, logCronRun, jsonResponse } from "@/lib/cron-utils";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const maxDuration = 300;

type SqlClient = NeonQueryFunction<false, false>;

interface MaxUserSource {
  user_id: string;
  niche_id: number | null;
  niche_slug: string | null;
  handle: string;
}

const POSTS_PER_HANDLE_PER_RUN = 12;

// ─── Migration ───────────────────────────────────────────────────────

async function ensureTiktokPostsTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS tiktok_posts (
      post_id TEXT PRIMARY KEY,
      account_handle TEXT NOT NULL,
      niche TEXT,
      niche_id INTEGER,
      user_id TEXT,
      caption TEXT,
      video_url TEXT,
      cover_url TEXT,
      music_name TEXT,
      plays BIGINT NOT NULL DEFAULT 0,
      likes BIGINT NOT NULL DEFAULT 0,
      shares BIGINT NOT NULL DEFAULT 0,
      comments BIGINT NOT NULL DEFAULT 0,
      hashtags JSONB,
      posted_at TIMESTAMPTZ,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB
    )
  `;
  // user_id index — multi-tenant queries
  await sql`CREATE INDEX IF NOT EXISTS tiktok_posts_user_idx ON tiktok_posts (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS tiktok_posts_niche_idx ON tiktok_posts (niche)`;
  await sql`CREATE INDEX IF NOT EXISTS tiktok_posts_posted_idx ON tiktok_posts (posted_at DESC)`;
}

// ─── Sources ─────────────────────────────────────────────────────────

async function listMaxUserTiktokSources(sql: SqlClient): Promise<MaxUserSource[]> {
  try {
    const rows = (await sql`
      SELECT ts.user_id,
             NULL::int AS niche_id,
             ts.niche::text AS niche_slug,
             ts.handle
        FROM tracked_sources ts
        INNER JOIN user_subscriptions_radar usr
          ON usr.user_id = ts.user_id
       WHERE ts.platform = 'tiktok'
         AND COALESCE(ts.active, TRUE) = TRUE
         AND usr.plan = 'max'
         AND usr.status = 'active'
    `) as Array<MaxUserSource>;
    return rows;
  } catch (err) {
    console.warn("[scrape-tiktok] listMaxUserTiktokSources fallback:", err);
    return [];
  }
}

// ─── Apify call (COMMENTED OUT por default — custos) ─────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _realApifyCall(
  apifyKey: string,
  handles: string[],
): Promise<Array<Record<string, unknown>>> {
  // ⚠️ Custo real: ~\$0.01 × N profiles. Ativar só quando actor for testado.
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=180`;
  const profiles = handles.map((h) => `https://www.tiktok.com/@${h.replace(/^@/, "")}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profiles,
      resultsPerPage: POSTS_PER_HANDLE_PER_RUN,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    throw new Error(`Apify TikTok ${res.status}`);
  }
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return Array.isArray(data) ? data : [];
}

// ─── Upsert ──────────────────────────────────────────────────────────

async function upsertTiktokPost(
  sql: SqlClient,
  post: Record<string, unknown>,
  source: MaxUserSource,
): Promise<boolean> {
  const postId = (post.id ?? post.videoId ?? post.aweme_id) as string | undefined;
  if (!postId) return false;
  try {
    await sql`
      INSERT INTO tiktok_posts (
        post_id, account_handle, niche, niche_id, user_id,
        caption, video_url, cover_url, music_name,
        plays, likes, shares, comments, hashtags, posted_at, fetched_at, raw
      )
      VALUES (
        ${postId},
        ${(post.authorMeta as { name?: string } | undefined)?.name ?? source.handle},
        ${source.niche_slug ?? null},
        ${source.niche_id ?? null},
        ${source.user_id},
        ${(post.text as string) ?? ""},
        ${(post.videoUrl as string) ?? null},
        ${(post.videoMeta as { coverUrl?: string } | undefined)?.coverUrl ?? null},
        ${(post.musicMeta as { musicName?: string } | undefined)?.musicName ?? null},
        ${(post.playCount as number) ?? 0},
        ${(post.diggCount as number) ?? 0},
        ${(post.shareCount as number) ?? 0},
        ${(post.commentCount as number) ?? 0},
        ${JSON.stringify((post.hashtags as Array<unknown>) ?? [])}::jsonb,
        ${typeof post.createTimeISO === "string" ? post.createTimeISO : new Date().toISOString()},
        NOW(),
        ${JSON.stringify(post)}::jsonb
      )
      ON CONFLICT (post_id) DO UPDATE SET
        plays = EXCLUDED.plays,
        likes = EXCLUDED.likes,
        shares = EXCLUDED.shares,
        comments = EXCLUDED.comments,
        fetched_at = NOW()
    `;
    return true;
  } catch (err) {
    console.warn(`[tiktok] upsert ${postId} failed:`, err);
    return false;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.reason ?? "Unauthorized" }, { status: 401 });
  }

  if (!isCronEnabled()) {
    return jsonResponse({
      ok: true,
      skipped: "RADAR_V2_CRON_ENABLED não setado",
      hint: "TikTok scraping é Max only. Setar env var pra ativar.",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const t0 = Date.now();

  // Migration on-demand (idempotente)
  try {
    await ensureTiktokPostsTable(sql);
  } catch (err) {
    return jsonResponse(
      { error: "migration failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const sources = await listMaxUserTiktokSources(sql);

  if (auth.isDry) {
    return jsonResponse({
      ok: true,
      dry: true,
      max_user_handles: sources.length,
      sample: sources.slice(0, 5).map((s) => ({ user: s.user_id, handle: s.handle, niche: s.niche_slug })),
      apify_call: "DISABLED — descomentar _realApifyCall em prod",
      duration_ms: Date.now() - t0,
    });
  }

  if (sources.length === 0) {
    await logCronRun(sql, {
      cronType: "scrape-tiktok",
      status: "skipped",
      errorMsg: "no_max_users_with_tiktok_sources",
    });
    return jsonResponse({
      ok: true,
      skipped: "Nenhum user Max com tracked_sources(platform=tiktok)",
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    await logCronRun(sql, {
      cronType: "scrape-tiktok",
      status: "error",
      errorMsg: "APIFY_API_KEY ausente",
    });
    return jsonResponse(
      { error: "APIFY_API_KEY ausente" },
      { status: 500 },
    );
  }

  // Group por user pra rodar 1 actor call por user (handles deles)
  const byUser = new Map<string, MaxUserSource[]>();
  for (const s of sources) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  const results: Array<{ user_id: string; handles: number; inserted: number; status: string }> = [];
  let totalInserted = 0;

  for (const [userId, userSources] of byUser) {
    const handles = userSources.map((s) => s.handle);
    try {
      // ⚠️ Apify call REAL desativada por padrão. Descomentar pra ativar:
      // const data = await _realApifyCall(apifyKey, handles);
      const data: Array<Record<string, unknown>> = [];

      let inserted = 0;
      for (const post of data) {
        // Mapeia post→source via authorMeta.name match
        const author = (post.authorMeta as { name?: string } | undefined)?.name ?? "";
        const source =
          userSources.find((s) => s.handle.toLowerCase() === author.toLowerCase()) ?? userSources[0];
        const ok = await upsertTiktokPost(sql, post, source);
        if (ok) inserted++;
      }

      totalInserted += inserted;
      results.push({
        user_id: userId,
        handles: handles.length,
        inserted,
        status: data.length === 0 ? "apify_disabled" : "success",
      });

      await logCronRun(sql, {
        cronType: "scrape-tiktok",
        userId,
        postsAdded: inserted,
        status: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ user_id: userId, handles: handles.length, inserted: 0, status: `error: ${msg.slice(0, 80)}` });
      await logCronRun(sql, {
        cronType: "scrape-tiktok",
        userId,
        status: "error",
        errorMsg: msg.slice(0, 500),
      });
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return jsonResponse({
    ok: true,
    total_inserted: totalInserted,
    users: byUser.size,
    apify_call: "DISABLED — descomentar _realApifyCall pra ativar",
    results,
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
