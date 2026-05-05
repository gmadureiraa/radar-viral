/**
 * /api/cron/refresh — Schedule diário 09:00 UTC.
 *
 * Portado de `code/_archive/viral-hunter-v1-legacy/api/cron/refresh.ts`.
 *
 * Pipelines:
 *  - News RSS: 30 portais (10 por nicho × 3) → news_articles
 *  - Instagram: Apify scraper iterando tracked_sources(platform=instagram,active)
 *    + fallback global TRACKED_IG quando user não tem fontes próprias
 *  - YouTube RSS: feeds dos canais do sources-curated → videos
 *
 * Auth: header `x-vercel-cron` OU Bearer CRON_SECRET OU ?token=.
 *
 * Feature flag: RADAR_V2_CRON_ENABLED=true exigido. Sem flag → skip.
 *
 * Idempotência:
 *  - news: ON CONFLICT (link) DO UPDATE SET fetched_at
 *  - ig:   ON CONFLICT (shortcode) DO UPDATE SET likes/comments/views
 *  - yt:   ON CONFLICT (video_id) DO UPDATE SET fetched_at
 *
 * Dry-run: ?dry=true devolve plano sem chamar APIs externas.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { checkCronAuth, isCronEnabled, getCronSql, logCronRun, jsonResponse } from "@/lib/cron-utils";

export const runtime = "nodejs";
export const maxDuration = 300;

type NicheId = "crypto" | "marketing" | "ai";
type SqlClient = NeonQueryFunction<false, false>;

// ─── Catálogos (espelham os do v1) ───────────────────────────────────

const TRACKED_IG_FALLBACK: Array<{ niche: NicheId; handle: string }> = [
  { niche: "crypto", handle: "coinbureau" },
  { niche: "crypto", handle: "augusto.backes" },
  { niche: "crypto", handle: "livecoins" },
  { niche: "crypto", handle: "defiverso" },
  { niche: "crypto", handle: "criptofacil" },
  { niche: "marketing", handle: "hormozi" },
  { niche: "marketing", handle: "brandsdecoded" },
  { niche: "marketing", handle: "blankschoolbr" },
  { niche: "marketing", handle: "mattgray" },
  { niche: "marketing", handle: "thejustinwelsh" },
  { niche: "ai", handle: "openai" },
  { niche: "ai", handle: "anthropicai" },
  { niche: "ai", handle: "aiboards" },
  { niche: "ai", handle: "futurepedia" },
  { niche: "ai", handle: "iamzainkahn" },
];

const NEWS_TOP: Array<{
  id: string;
  name: string;
  rss: string;
  lang: "en" | "pt";
  niche: NicheId;
  cat: string;
  color: string;
}> = [
  // crypto
  { id: "cointelegraph", name: "CoinTelegraph", rss: "https://cointelegraph.com/rss", lang: "en", niche: "crypto", cat: "crypto", color: "#00A651" },
  { id: "coindesk", name: "CoinDesk", rss: "https://www.coindesk.com/arc/outboundfeeds/rss/", lang: "en", niche: "crypto", cat: "crypto", color: "#006FFF" },
  { id: "decrypt", name: "Decrypt", rss: "https://decrypt.co/feed", lang: "en", niche: "crypto", cat: "crypto", color: "#8B5CF6" },
  { id: "theblock", name: "The Block", rss: "https://www.theblock.co/rss", lang: "en", niche: "crypto", cat: "defi", color: "#1D4ED8" },
  { id: "bitcoinmagazine", name: "Bitcoin Magazine", rss: "https://bitcoinmagazine.com/.rss/full/", lang: "en", niche: "crypto", cat: "bitcoin", color: "#F7931A" },
  { id: "thedefiant", name: "The Defiant", rss: "https://thedefiant.io/feed/", lang: "en", niche: "crypto", cat: "defi", color: "#EC4899" },
  { id: "beincrypto", name: "BeInCrypto", rss: "https://beincrypto.com/feed/", lang: "en", niche: "crypto", cat: "crypto", color: "#14B8A6" },
  { id: "portaldobitcoin", name: "Portal do Bitcoin", rss: "https://portaldobitcoin.uol.com.br/feed/", lang: "pt", niche: "crypto", cat: "bitcoin", color: "#EAB308" },
  { id: "criptofacil", name: "CriptoFácil", rss: "https://www.criptofacil.com/feed/", lang: "pt", niche: "crypto", cat: "crypto", color: "#3B82F6" },
  { id: "livecoins", name: "Livecoins", rss: "https://livecoins.com.br/feed/", lang: "pt", niche: "crypto", cat: "crypto", color: "#10B981" },
  // marketing
  { id: "searchengineland", name: "Search Engine Land", rss: "https://searchengineland.com/feed", lang: "en", niche: "marketing", cat: "seo", color: "#F37021" },
  { id: "searchenginejournal", name: "Search Engine Journal", rss: "https://www.searchenginejournal.com/feed/", lang: "en", niche: "marketing", cat: "seo", color: "#0099E5" },
  { id: "moz-blog", name: "Moz Blog", rss: "https://moz.com/feeds/blog", lang: "en", niche: "marketing", cat: "seo", color: "#055498" },
  { id: "ahrefs-blog", name: "Ahrefs Blog", rss: "https://ahrefs.com/blog/feed/", lang: "en", niche: "marketing", cat: "seo", color: "#FF6F00" },
  { id: "marketingbrew", name: "Marketing Brew", rss: "https://www.marketingbrew.com/feed", lang: "en", niche: "marketing", cat: "growth", color: "#F97316" },
  { id: "hubspot-blog", name: "HubSpot Blog", rss: "https://blog.hubspot.com/marketing/rss.xml", lang: "en", niche: "marketing", cat: "growth", color: "#FF7A59" },
  { id: "copyblogger", name: "Copyblogger", rss: "https://copyblogger.com/feed/", lang: "en", niche: "marketing", cat: "copy", color: "#9333EA" },
  { id: "meioemensagem", name: "Meio & Mensagem", rss: "https://www.meioemensagem.com.br/feed", lang: "pt", niche: "marketing", cat: "business", color: "#0F766E" },
  { id: "rdstation-blog", name: "RD Station Blog", rss: "https://resultadosdigitais.com.br/blog/feed/", lang: "pt", niche: "marketing", cat: "growth", color: "#11AA63" },
  { id: "rockcontent-blog", name: "Rock Content Blog", rss: "https://rockcontent.com/br/blog/feed/", lang: "pt", niche: "marketing", cat: "content", color: "#FF5A1F" },
  // ai
  { id: "theverge-ai", name: "The Verge — AI", rss: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", lang: "en", niche: "ai", cat: "news", color: "#FA4317" },
  { id: "venturebeat-ai", name: "VentureBeat — AI", rss: "https://venturebeat.com/category/ai/feed/", lang: "en", niche: "ai", cat: "news", color: "#1A237E" },
  { id: "techcrunch-ai", name: "TechCrunch — AI", rss: "https://techcrunch.com/category/artificial-intelligence/feed/", lang: "en", niche: "ai", cat: "news", color: "#0A9F23" },
  { id: "huggingface-blog", name: "HuggingFace Blog", rss: "https://huggingface.co/blog/feed.xml", lang: "en", niche: "ai", cat: "research", color: "#FFD21E" },
  { id: "openai-blog", name: "OpenAI Blog", rss: "https://openai.com/blog/rss.xml", lang: "en", niche: "ai", cat: "research", color: "#10A37F" },
  { id: "anthropic-news", name: "Anthropic News", rss: "https://www.anthropic.com/news/rss", lang: "en", niche: "ai", cat: "research", color: "#D97757" },
  { id: "simonw-blog", name: "Simon Willison's Blog", rss: "https://simonwillison.net/atom/everything/", lang: "en", niche: "ai", cat: "tools", color: "#A78BFA" },
  { id: "aimultiple", name: "AIMultiple", rss: "https://research.aimultiple.com/feed/", lang: "en", niche: "ai", cat: "research", color: "#3B82F6" },
  { id: "marktechpost", name: "MarkTechPost", rss: "https://www.marktechpost.com/feed/", lang: "en", niche: "ai", cat: "research", color: "#0EA5E9" },
  { id: "wired-ai", name: "Wired — AI", rss: "https://www.wired.com/feed/tag/ai/latest/rss", lang: "en", niche: "ai", cat: "news", color: "#000000" },
];

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
    .slice(0, 500);
}

// ─── News RSS ────────────────────────────────────────────────────────

async function refreshNews(sql: SqlClient): Promise<number> {
  let inserted = 0;
  for (const source of NEWS_TOP) {
    try {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.rss)}`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        status: string;
        items?: Array<{
          title: string;
          link: string;
          pubDate: string;
          description?: string;
          thumbnail?: string;
          enclosure?: { link?: string };
        }>;
      };
      if (data.status !== "ok" || !Array.isArray(data.items)) continue;
      for (const item of data.items.slice(0, 10)) {
        try {
          await sql`
            INSERT INTO news_articles (
              link, source_id, source_name, source_color, language,
              niche, category, title, description, thumbnail, pub_date, fetched_at
            )
            VALUES (
              ${item.link}, ${source.id}, ${source.name}, ${source.color}, ${source.lang},
              ${source.niche}, ${source.cat}, ${item.title},
              ${stripHtml(item.description ?? "")},
              ${item.thumbnail ?? item.enclosure?.link ?? null},
              ${item.pubDate ?? new Date().toISOString()}, NOW()
            )
            ON CONFLICT (link) DO UPDATE SET fetched_at = NOW()
          `;
          inserted++;
        } catch {
          /* dup or schema issue — skip */
        }
      }
    } catch {
      /* skip portal */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return inserted;
}

// ─── Instagram (Apify) ───────────────────────────────────────────────

const POSTS_PER_NICHE_PER_DAY = 100;

async function postsAddedToday(sql: SqlClient, nicheSlug: string): Promise<number> {
  try {
    const rows = (await sql`
      SELECT COALESCE(SUM(posts_added), 0)::int AS n
        FROM cron_run_log
       WHERE cron_type = 'refresh-ig'
         AND error_msg IS NULL
         AND ran_at >= NOW() - INTERVAL '24 hours'
    `) as Array<{ n: number }>;
    void nicheSlug;
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

interface IgBundle {
  slug: NicheId;
  handles: string[];
}

async function listIgBundles(sql: SqlClient): Promise<IgBundle[]> {
  // 1) tenta tracked_sources globais (user_id NULL ou seed-gabriel) primeiro
  let dbRows: Array<{ niche: string; handle: string }> = [];
  try {
    dbRows = (await sql`
      SELECT COALESCE(niche::text, '') AS niche, handle
        FROM tracked_sources
       WHERE platform = 'instagram'
         AND COALESCE(active, TRUE) = TRUE
    `) as Array<{ niche: string; handle: string }>;
  } catch {
    /* tabela pode não ter colunas ainda — fallback */
  }

  const grouped = new Map<NicheId, Set<string>>();
  for (const r of dbRows) {
    if (!["crypto", "marketing", "ai"].includes(r.niche)) continue;
    const slug = r.niche as NicheId;
    if (!grouped.has(slug)) grouped.set(slug, new Set());
    grouped.get(slug)!.add(r.handle.replace(/^@/, ""));
  }

  // 2) Fallback: TRACKED_IG_FALLBACK pra cada nicho que não veio do DB
  for (const fb of TRACKED_IG_FALLBACK) {
    if (!grouped.has(fb.niche)) grouped.set(fb.niche, new Set());
    grouped.get(fb.niche)!.add(fb.handle);
  }

  const out: IgBundle[] = [];
  for (const [slug, set] of grouped) {
    out.push({ slug, handles: Array.from(set) });
  }
  return out;
}

async function refreshIgBundle(
  sql: SqlClient,
  apifyKey: string,
  bundle: IgBundle,
): Promise<{ inserted: number; status: string; errorMsg?: string }> {
  const used = await postsAddedToday(sql, bundle.slug);
  if (used >= POSTS_PER_NICHE_PER_DAY) {
    return { inserted: 0, status: "rate_limited" };
  }
  if (bundle.handles.length === 0) {
    return { inserted: 0, status: "no_handles" };
  }

  const directUrls = bundle.handles.map((h) => `https://www.instagram.com/${h}/`);
  try {
    const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=120`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls,
        resultsType: "posts",
        resultsLimit: 3,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      return { inserted: 0, status: "error", errorMsg: `Apify ${res.status}` };
    }
    const data = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) {
      return { inserted: 0, status: "error", errorMsg: "non-array response" };
    }

    let inserted = 0;
    const remaining = POSTS_PER_NICHE_PER_DAY - used;
    for (const post of data) {
      if (inserted >= remaining) break;
      const shortcode = (post.shortCode ?? post.shortcode) as string | undefined;
      if (!shortcode) continue;
      const childPosts = (post.childPosts as Array<{ displayUrl?: string }> | undefined) ?? [];
      const images = (post.images as Array<{ displayUrl?: string }> | undefined) ?? [];
      const childUrls: string[] = [
        ...(childPosts.map((c) => c.displayUrl).filter(Boolean) as string[]),
        ...(images.map((i) => i.displayUrl).filter(Boolean) as string[]),
      ];
      try {
        await sql`
          INSERT INTO instagram_posts (
            shortcode, account_handle, niche, type, caption, display_url,
            child_urls, video_url, likes, comments, views, hashtags, mentions,
            posted_at, scraped_at, raw
          )
          VALUES (
            ${shortcode},
            ${(post.ownerUsername as string) ?? bundle.handles[0]},
            ${bundle.slug},
            ${(post.type as string) ?? "Image"},
            ${(post.caption as string) ?? ""},
            ${(post.displayUrl as string) ?? ""},
            ${JSON.stringify(childUrls)}::jsonb,
            ${(post.videoUrl as string) ?? null},
            ${(post.likesCount as number) ?? 0},
            ${(post.commentsCount as number) ?? 0},
            ${(post.videoViewCount as number) ?? (post.videoPlayCount as number) ?? 0},
            ${JSON.stringify((post.hashtags as string[]) ?? [])}::jsonb,
            ${JSON.stringify((post.mentions as string[]) ?? [])}::jsonb,
            ${(post.timestamp as string) ?? new Date().toISOString()},
            NOW(),
            ${JSON.stringify(post)}::jsonb
          )
          ON CONFLICT (shortcode) DO UPDATE SET
            likes = EXCLUDED.likes,
            comments = EXCLUDED.comments,
            views = EXCLUDED.views,
            scraped_at = NOW()
        `;
        inserted++;
      } catch (insertErr) {
        // Antes: silent catch. Agora propaga pra resultado.
        return {
          inserted,
          status: "error",
          errorMsg: `insert ${shortcode}: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`,
        };
      }
    }
    return { inserted, status: "success" };
  } catch (err) {
    return { inserted: 0, status: "error", errorMsg: err instanceof Error ? err.message : String(err) };
  }
}

async function refreshIg(sql: SqlClient): Promise<{
  inserted: number;
  bundles: number;
  results: Array<{ slug: string; status: string; inserted: number; errorMsg?: string }>;
}> {
  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    return { inserted: 0, bundles: 0, results: [] };
  }
  const bundles = await listIgBundles(sql);
  const POOL = 3;
  const results: Array<{ slug: string; status: string; inserted: number; errorMsg?: string }> = [];
  let totalInserted = 0;

  const startedAt = Date.now();
  const SOFT_TIMEOUT_MS = 240_000;

  for (let i = 0; i < bundles.length; i += POOL) {
    if (Date.now() - startedAt > SOFT_TIMEOUT_MS) {
      const remaining = bundles.slice(i);
      for (const b of remaining) {
        results.push({ slug: b.slug, status: "skipped-timeout", inserted: 0 });
      }
      break;
    }
    const batch = bundles.slice(i, i + POOL);
    const settled = await Promise.allSettled(
      batch.map((b) => refreshIgBundle(sql, apifyKey, b)),
    );
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      const b = batch[j];
      if (r.status === "fulfilled") {
        totalInserted += r.value.inserted;
        results.push({
          slug: b.slug,
          status: r.value.status,
          inserted: r.value.inserted,
          errorMsg: r.value.errorMsg,
        });
      } else {
        results.push({
          slug: b.slug,
          status: "rejected",
          inserted: 0,
          errorMsg: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { inserted: totalInserted, bundles: bundles.length, results };
}

// ─── YouTube RSS (lightweight) ───────────────────────────────────────
// Lê tabela `videos` (canônica do v1). RSS YT formato:
// https://www.youtube.com/feeds/videos.xml?channel_id=UC...

async function refreshYoutube(
  sql: SqlClient,
): Promise<{ inserted: number; errors: string[] }> {
  // Catálogo curado (lib/youtube-channels.ts) — importado do v1, 51 canais
  // com channelId resolvido. Antes lia de tracked_sources mas só havia 3
  // entries com metadata vazia, daí o feed parou sem aviso.
  const { YOUTUBE_CHANNELS } = await import("@/lib/youtube-channels");

  let inserted = 0;
  const errors: string[] = [];
  for (const ch of YOUTUBE_CHANNELS) {
    if (!ch.channelId) continue;
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`;
      const res = await fetch(rssUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; RadarViral/1.0; +https://radar.kaleidos.com.br)",
        },
      });
      if (!res.ok) {
        errors.push(`${ch.handle}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      // Parser leve (regex). Pega até 10 entries mais recentes.
      const entries = xml.split(/<entry>/).slice(1, 11);
      for (const e of entries) {
        const idMatch = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(e);
        const titleMatch = /<title>([^<]+)<\/title>/.exec(e);
        const publishedMatch = /<published>([^<]+)<\/published>/.exec(e);
        const thumbMatch = /<media:thumbnail[^>]*url="([^"]+)"/.exec(e);
        const linkMatch = /<link[^>]*href="([^"]+)"/.exec(e);
        if (!idMatch || !titleMatch) continue;
        const videoId = idMatch[1];
        const link = linkMatch?.[1] ?? `https://www.youtube.com/watch?v=${videoId}`;
        try {
          // Schema real da tabela videos:
          // video_id, channel_id, channel_name, channel_handle, country, category,
          // title, thumbnail_url, published_at, link, first_seen_at, last_seen_at
          await sql`
            INSERT INTO videos (
              video_id, channel_id, channel_name, channel_handle,
              title, thumbnail_url, published_at, link,
              first_seen_at, last_seen_at
            )
            VALUES (
              ${videoId}, ${ch.channelId}, ${ch.name}, ${ch.handle},
              ${decodeXmlEntities(titleMatch[1])},
              ${thumbMatch?.[1] ?? null},
              ${publishedMatch?.[1] ?? new Date().toISOString()},
              ${link},
              NOW(), NOW()
            )
            ON CONFLICT (video_id) DO UPDATE SET
              last_seen_at = NOW(),
              title = EXCLUDED.title,
              thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, videos.thumbnail_url)
          `;
          inserted++;
        } catch (insertErr) {
          errors.push(
            `insert ${videoId}: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`,
          );
        }
      }
    } catch (channelErr) {
      errors.push(
        `fetch ${ch.handle}: ${channelErr instanceof Error ? channelErr.message : String(channelErr)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { inserted, errors: errors.slice(0, 20) };
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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
      hint: "v1 legacy ainda popula DB. Setar env var pra ativar v2 cron.",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const t0 = Date.now();

  if (auth.isDry) {
    const bundles = await listIgBundles(sql);
    return jsonResponse({
      ok: true,
      dry: true,
      news_sources: NEWS_TOP.length,
      ig_bundles: bundles.map((b) => ({ slug: b.slug, handles: b.handles.length })),
      duration_ms: Date.now() - t0,
    });
  }

  const summary: Record<string, unknown> = {};

  // News
  try {
    const n = await refreshNews(sql);
    summary.news_inserted = n;
    await logCronRun(sql, { cronType: "refresh-news", postsAdded: n, status: "success" });
  } catch (err) {
    summary.news_error = err instanceof Error ? err.message : String(err);
    await logCronRun(sql, {
      cronType: "refresh-news",
      status: "error",
      errorMsg: String(err).slice(0, 500),
    });
  }

  // Instagram
  try {
    const ig = await refreshIg(sql);
    summary.ig_inserted = ig.inserted;
    summary.ig_bundles = ig.bundles;
    summary.ig_results = ig.results;
    await logCronRun(sql, {
      cronType: "refresh-ig",
      postsAdded: ig.inserted,
      status: "success",
    });
  } catch (err) {
    summary.ig_error = err instanceof Error ? err.message : String(err);
    await logCronRun(sql, {
      cronType: "refresh-ig",
      status: "error",
      errorMsg: String(err).slice(0, 500),
    });
  }

  // YouTube
  try {
    const y = await refreshYoutube(sql);
    summary.youtube_inserted = y.inserted;
    if (y.errors.length > 0) summary.youtube_partial_errors = y.errors;
    await logCronRun(sql, {
      cronType: "refresh-youtube",
      postsAdded: y.inserted,
      status: y.errors.length > 0 && y.inserted === 0 ? "error" : "success",
      errorMsg: y.errors.length > 0 ? y.errors.slice(0, 5).join(" | ").slice(0, 500) : undefined,
    });
  } catch (err) {
    summary.youtube_error = err instanceof Error ? err.message : String(err);
    await logCronRun(sql, {
      cronType: "refresh-youtube",
      status: "error",
      errorMsg: String(err).slice(0, 500),
    });
  }

  summary.duration_ms = Date.now() - t0;
  return jsonResponse({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return GET(req);
}

// silence unused export warning
void neon;
