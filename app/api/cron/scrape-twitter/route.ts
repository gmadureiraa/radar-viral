/**
 * /api/cron/scrape-twitter — Schedule diário 12:30 UTC (offset 30min do TikTok
 * pra não disputar slot de função na Vercel).
 *
 * Plano Pro/Max only. Apify actor `apidojo/twitter-scraper-lite`
 * (~\$0.40 por 1.000 tweets ≈ \$0.0004/tweet, mais barato e estável que
 * outros actors do nicho).
 *
 * Pipeline:
 *  1. Lista users com plan IN ('pro','max') active
 *  2. Pra cada user, lista tracked_sources(platform='twitter',active=true)
 *  3. Roda actor → upsert em twitter_posts
 *
 * Migration twitter_posts: cria IF NOT EXISTS no startup do handler
 * (mesmo padrão do scrape-tiktok — idempotente).
 *
 * Auth + flag + dry-run idem refresh/brief/scrape-tiktok.
 *
 * NOTA: a chamada Apify real está COMENTADA por padrão pra evitar custo
 * inadvertido até o actor estar configurado e os caps testados. Para ativar:
 *  1. Confirmar conta Apify tem actor apidojo/twitter-scraper-lite instalado
 *  2. Descomentar o bloco `_realApifyCall` abaixo
 *  3. Setar APIFY_API_KEY no Vercel
 *  4. (Kill-switch extra) garantir TWITTER_SCRAPE_DISABLED != "true"
 *
 * Custo estimado por user Pro com 8 handles:
 *   8 handles × 5 tweets/run × 30 runs/mês = 1.200 tweets/mês
 *   1.200 × \$0.0004 = ~\$0.48/user/mês
 */

import { checkCronAuth, isCronEnabled, getCronSql, logCronRun, jsonResponse } from "@/lib/cron-utils";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const maxDuration = 300;

type SqlClient = NeonQueryFunction<false, false>;

interface PaidUserSource {
  user_id: string;
  niche_id: number | null;
  niche_slug: string | null;
  handle: string;
}

/**
 * X é caro de scrape (cobra por item retornado, não por run). Mantemos
 * conservador em 5 tweets/handle/run. Total ~40 tweets por user com 8
 * handles. Aumentar isso só com cap monitorado em produção.
 */
const POSTS_PER_HANDLE_PER_RUN = 5;

// ─── Migration ───────────────────────────────────────────────────────

async function ensureTwitterPostsTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS twitter_posts (
      tweet_id TEXT PRIMARY KEY,
      account_handle TEXT NOT NULL,
      niche TEXT,
      niche_id INTEGER,
      user_id TEXT,
      text TEXT,
      lang TEXT,
      retweet_count BIGINT NOT NULL DEFAULT 0,
      reply_count BIGINT NOT NULL DEFAULT 0,
      like_count BIGINT NOT NULL DEFAULT 0,
      quote_count BIGINT NOT NULL DEFAULT 0,
      view_count BIGINT NOT NULL DEFAULT 0,
      has_media BOOLEAN NOT NULL DEFAULT FALSE,
      media_urls JSONB,
      is_quote BOOLEAN NOT NULL DEFAULT FALSE,
      posted_at TIMESTAMPTZ,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS twitter_posts_user_idx ON twitter_posts (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS twitter_posts_niche_idx ON twitter_posts (niche)`;
  await sql`CREATE INDEX IF NOT EXISTS twitter_posts_posted_idx ON twitter_posts (posted_at DESC)`;
}

// ─── Sources ─────────────────────────────────────────────────────────

async function listPaidUserTwitterSources(sql: SqlClient): Promise<PaidUserSource[]> {
  try {
    const rows = (await sql`
      SELECT ts.user_id,
             NULL::int AS niche_id,
             ts.niche::text AS niche_slug,
             ts.handle
        FROM tracked_sources ts
        INNER JOIN user_subscriptions_radar usr
          ON usr.user_id = ts.user_id
       WHERE ts.platform = 'twitter'
         AND COALESCE(ts.active, TRUE) = TRUE
         AND usr.plan IN ('pro', 'max')
         AND usr.status = 'active'
    `) as Array<PaidUserSource>;
    return rows;
  } catch (err) {
    console.warn("[scrape-twitter] listPaidUserTwitterSources fallback:", err);
    return [];
  }
}

// ─── Apify call (COMMENTED OUT por default — custos) ─────────────────

/**
 * Input shape do actor `apidojo/twitter-scraper-lite` (confirmado em
 * apify.com/apidojo/twitter-scraper-lite, 2026-05-08):
 *
 *   {
 *     searchTerms: string[]   // queries advanced search ("from:handle" etc)
 *     maxItems: number        // total cap
 *     sort: "Latest" | "Top" | "Latest+Top"
 *     // opcionais:
 *     startUrls, twitterHandles, onlyVerifiedUsers, onlyImage, onlyVideo
 *   }
 *
 * Estratégia: usar `searchTerms: handles.map(h => "from:" + h)` que é
 * mais flexível que `twitterHandles` (permite combinar com filtros) e
 * `sort: "Latest"` pra pegar as últimas. `maxItems = 5 × handles.length`
 * pra ficar conservador no custo (actor cobra por item).
 *
 * Output relevante por tweet (campos que upsertamos):
 *   id, url, text, lang, retweetCount, replyCount, likeCount,
 *   quoteCount, viewCount, bookmarkCount, createdAt, isQuote, isReply,
 *   author.userName, media[] (com url/type)
 */
async function _realApifyCall(
  apifyKey: string,
  handles: string[],
): Promise<Array<Record<string, unknown>>> {
  // ⚠️ Custo real: ~\$0.0004 × N tweets retornados. Ativar só quando
  // actor for testado e env TWITTER_SCRAPE_DISABLED for unset/false.
  if (process.env.TWITTER_SCRAPE_DISABLED === "true") {
    console.warn("[scrape-twitter] kill-switch TWITTER_SCRAPE_DISABLED=true, abortando");
    return [];
  }
  const url = `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/run-sync-get-dataset-items?token=${apifyKey}&timeout=180`;
  const searchTerms = handles.map((h) => `from:${h.replace(/^@/, "")}`);
  const maxItems = POSTS_PER_HANDLE_PER_RUN * handles.length;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchTerms,
      maxItems,
      sort: "Latest",
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    throw new Error(`Apify Twitter ${res.status}`);
  }
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return Array.isArray(data) ? data : [];
}

// ─── Upsert ──────────────────────────────────────────────────────────

interface AuthorMeta {
  userName?: string;
  screen_name?: string;
}

interface MediaItem {
  url?: string;
  media_url_https?: string;
  type?: string;
}

function extractMediaUrls(post: Record<string, unknown>): string[] {
  const media = post.media;
  if (!Array.isArray(media)) return [];
  const urls: string[] = [];
  for (const item of media as MediaItem[]) {
    const u = item?.url ?? item?.media_url_https;
    if (typeof u === "string" && u.length > 0) urls.push(u);
  }
  return urls;
}

async function upsertTwitterPost(
  sql: SqlClient,
  post: Record<string, unknown>,
  source: PaidUserSource,
): Promise<boolean> {
  const tweetId = (post.id ?? post.tweet_id ?? post.id_str) as string | undefined;
  if (!tweetId) return false;
  try {
    const author = (post.author as AuthorMeta | undefined) ?? {};
    const handle = author.userName ?? author.screen_name ?? source.handle;
    const mediaUrls = extractMediaUrls(post);
    const hasMedia = mediaUrls.length > 0;
    const postedAt =
      typeof post.createdAt === "string"
        ? post.createdAt
        : typeof post.created_at === "string"
          ? (post.created_at as string)
          : new Date().toISOString();
    await sql`
      INSERT INTO twitter_posts (
        tweet_id, account_handle, niche, niche_id, user_id,
        text, lang,
        retweet_count, reply_count, like_count, quote_count, view_count,
        has_media, media_urls, is_quote, posted_at, fetched_at, raw
      )
      VALUES (
        ${tweetId},
        ${handle},
        ${source.niche_slug ?? null},
        ${source.niche_id ?? null},
        ${source.user_id},
        ${(post.text as string) ?? ""},
        ${(post.lang as string) ?? null},
        ${(post.retweetCount as number) ?? 0},
        ${(post.replyCount as number) ?? 0},
        ${(post.likeCount as number) ?? 0},
        ${(post.quoteCount as number) ?? 0},
        ${(post.viewCount as number) ?? 0},
        ${hasMedia},
        ${JSON.stringify(mediaUrls)}::jsonb,
        ${Boolean(post.isQuote)},
        ${postedAt},
        NOW(),
        ${JSON.stringify(post)}::jsonb
      )
      ON CONFLICT (tweet_id) DO UPDATE SET
        retweet_count = EXCLUDED.retweet_count,
        reply_count = EXCLUDED.reply_count,
        like_count = EXCLUDED.like_count,
        quote_count = EXCLUDED.quote_count,
        view_count = EXCLUDED.view_count,
        fetched_at = NOW()
    `;
    return true;
  } catch (err) {
    console.warn(`[twitter] upsert ${tweetId} failed:`, err);
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
      hint: "X/Twitter scraping é Pro/Max. Setar env var pra ativar.",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const t0 = Date.now();

  // Migration on-demand (idempotente)
  try {
    await ensureTwitterPostsTable(sql);
  } catch (err) {
    return jsonResponse(
      { error: "migration failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const sources = await listPaidUserTwitterSources(sql);

  if (auth.isDry) {
    return jsonResponse({
      ok: true,
      dry: true,
      paid_user_handles: sources.length,
      sample: sources.slice(0, 5).map((s) => ({ user: s.user_id, handle: s.handle, niche: s.niche_slug })),
      apify_call: "DISABLED — descomentar _realApifyCall em prod",
      kill_switch_env: "TWITTER_SCRAPE_DISABLED",
      duration_ms: Date.now() - t0,
    });
  }

  if (sources.length === 0) {
    await logCronRun(sql, {
      cronType: "scrape-twitter",
      status: "skipped",
      errorMsg: "no_paid_users_with_twitter_sources",
    });
    return jsonResponse({
      ok: true,
      skipped: "Nenhum user Pro/Max com tracked_sources(platform=twitter)",
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    await logCronRun(sql, {
      cronType: "scrape-twitter",
      status: "error",
      errorMsg: "APIFY_API_KEY ausente",
    });
    return jsonResponse(
      { error: "APIFY_API_KEY ausente" },
      { status: 500 },
    );
  }

  // Group por user pra rodar 1 actor call por user (handles deles)
  const byUser = new Map<string, PaidUserSource[]>();
  for (const s of sources) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  const results: Array<{ user_id: string; handles: number; inserted: number; status: string }> = [];
  let totalInserted = 0;

  for (const [userId, userSources] of byUser) {
    const handles = userSources.map((s) => s.handle);
    try {
      // Apify call REAL ativada (2026-05-08). Kill-switch interno:
      // se TWITTER_SCRAPE_DISABLED=true, _realApifyCall retorna [] sem
      // chamar Apify e evita custo.
      const data = await _realApifyCall(apifyKey, handles);

      let inserted = 0;
      for (const post of data) {
        // Mapeia post→source via author.userName match
        const author = (post.author as AuthorMeta | undefined) ?? {};
        const authorHandle = author.userName ?? author.screen_name ?? "";
        const source =
          userSources.find((s) => s.handle.toLowerCase() === authorHandle.toLowerCase()) ?? userSources[0];
        const ok = await upsertTwitterPost(sql, post, source);
        if (ok) inserted++;
      }

      totalInserted += inserted;
      results.push({
        user_id: userId,
        handles: handles.length,
        inserted,
        status: data.length === 0 ? "no_data_or_killed" : "success",
      });

      await logCronRun(sql, {
        cronType: "scrape-twitter",
        userId,
        postsAdded: inserted,
        status: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ user_id: userId, handles: handles.length, inserted: 0, status: `error: ${msg.slice(0, 80)}` });
      await logCronRun(sql, {
        cronType: "scrape-twitter",
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
    apify_call: "ACTIVE (kill-switch: TWITTER_SCRAPE_DISABLED)",
    results,
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
