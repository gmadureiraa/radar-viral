/**
 * /api/cron/scrape-threads — Schedule diário 12:00 UTC.
 *
 * Plano Pro+ (pro/max). Apify actor `apify/threads-scraper` (~\$0.0005/post).
 *
 * Pipeline:
 *  1. Lista users com plan IN ('pro','max') active
 *  2. Pra cada user, lista tracked_sources(platform='threads',active=true)
 *  3. Roda actor → upsert em threads_posts
 *
 * Migration threads_posts: cria IF NOT EXISTS no startup do handler.
 *
 * Auth + flag + dry-run idem refresh/brief/scrape-tiktok.
 *
 * Kill-switches:
 *   - RADAR_V2_CRON_ENABLED=true (geral, igual outros crons)
 *   - THREADS_SCRAPE_DISABLED=true desativa SÓ esse cron sem mexer no resto
 *
 * NOTA: a chamada Apify real está COMENTADA por padrão pra evitar custo
 * inadvertido até o actor estar configurado e os caps testados. Para
 * ativar:
 *  1. Confirmar conta Apify tem actor apify/threads-scraper instalado
 *  2. Descomentar o bloco `_realApifyCall` abaixo (linha do `realApifyCall`)
 *  3. Setar APIFY_API_KEY no Vercel
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
  plan: "free" | "pro" | "max";
}

// ─── Migration ───────────────────────────────────────────────────────

async function ensureThreadsPostsTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS threads_posts (
      post_id TEXT PRIMARY KEY,
      account_handle TEXT NOT NULL,
      niche TEXT,
      niche_id INTEGER,
      user_id TEXT,
      caption TEXT,
      media_url TEXT[],
      reposts BIGINT NOT NULL DEFAULT 0,
      replies BIGINT NOT NULL DEFAULT 0,
      likes BIGINT NOT NULL DEFAULT 0,
      posted_at TIMESTAMPTZ,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS threads_posts_user_idx ON threads_posts (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS threads_posts_niche_idx ON threads_posts (niche)`;
  await sql`CREATE INDEX IF NOT EXISTS threads_posts_posted_idx ON threads_posts (posted_at DESC)`;
}

// ─── Sources ─────────────────────────────────────────────────────────

async function listIndividualUserThreadsSources(sql: SqlClient): Promise<PaidUserSource[]> {
  // 2026-05-08: Free agora tem cron individual (3 fontes, 3 posts/handle).
  // Pro/Max: 60/100 fontes, 12 posts/handle. Sem subscription = free default.
  try {
    const rows = (await sql`
      SELECT ts.user_id,
             NULL::int AS niche_id,
             ts.niche::text AS niche_slug,
             ts.handle,
             COALESCE(usr.plan, 'free') AS plan
        FROM tracked_sources ts
        LEFT JOIN user_subscriptions_radar usr
          ON usr.user_id = ts.user_id
         AND usr.status = 'active'
       WHERE ts.platform = 'threads'
         AND COALESCE(ts.active, TRUE) = TRUE
         AND ts.user_id IS NOT NULL
    `) as Array<PaidUserSource>;
    return rows;
  } catch (err) {
    console.warn("[scrape-threads] listIndividualUserThreadsSources fallback:", err);
    return [];
  }
}

// ─── Apify call (COMMENTED OUT por default — custos) ─────────────────

async function _realApifyCall(
  apifyKey: string,
  handles: string[],
  postsPerHandle: number,
): Promise<Array<Record<string, unknown>>> {
  // Actor: automation-lab/threads-scraper — validado em prod 2026-05-08.
  // Custo: $0.02 start (FREE) + $0.005 por profile + $0.005 por post.
  // Free user: 3 fontes × 3 posts = $0.02 + $0.015 + $0.045 = $0.08/run
  // Pro user: 10 fontes × 12 posts = $0.67/run, ~$20/user/mês full-load.
  // Kill-switch: THREADS_SCRAPE_DISABLED=true aborta sem chamar Apify.
  if (process.env.THREADS_SCRAPE_DISABLED === "true") {
    console.warn("[scrape-threads] kill-switch THREADS_SCRAPE_DISABLED=true, abortando");
    return [];
  }
  const usernames = handles.map((h) => h.replace(/^@/, ""));
  const url = `https://api.apify.com/v2/acts/automation-lab~threads-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=180`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "posts",
      usernames,
      maxPosts: postsPerHandle,
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    throw new Error(`Apify Threads ${res.status}`);
  }
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return Array.isArray(data) ? data : [];
}

// ─── Upsert ──────────────────────────────────────────────────────────

async function upsertThreadsPost(
  sql: SqlClient,
  post: Record<string, unknown>,
  source: PaidUserSource,
): Promise<boolean> {
  // Skip non-post items (actor retorna mistura type='profile' + type='post')
  if (post.type && post.type !== "post") return false;
  const postId = (post.postId ?? post.id ?? post.code) as string | undefined;
  if (!postId) return false;
  try {
    // automation-lab/threads-scraper retorna `media` como array de objects
    // com {url, type}. Normaliza pra TEXT[].
    const mediaRaw = post.media;
    const mediaArr: string[] = [];
    if (Array.isArray(mediaRaw)) {
      for (const m of mediaRaw) {
        if (typeof m === "string") mediaArr.push(m);
        else if (m && typeof m === "object") {
          const candidate = (m as { url?: string; src?: string }).url ?? (m as { url?: string; src?: string }).src;
          if (typeof candidate === "string") mediaArr.push(candidate);
        }
      }
    }

    const author = (post.username as string | undefined) ?? source.handle;

    // `date` vem em ISO 8601 ("2026-05-08T13:02:04.000Z"). `timestamp` é
    // unix seconds. Preferir date.
    const postedAt = typeof post.date === "string"
      ? post.date
      : typeof post.timestamp === "number"
        ? new Date(post.timestamp * 1000).toISOString()
        : new Date().toISOString();

    await sql`
      INSERT INTO threads_posts (
        post_id, account_handle, niche, niche_id, user_id,
        caption, media_url,
        reposts, replies, likes,
        posted_at, fetched_at, raw
      )
      VALUES (
        ${postId},
        ${author},
        ${source.niche_slug ?? null},
        ${source.niche_id ?? null},
        ${source.user_id},
        ${(post.text as string) ?? ""},
        ${mediaArr},
        ${(post.repostCount as number) ?? 0},
        ${(post.replyCount as number) ?? 0},
        ${(post.likeCount as number) ?? 0},
        ${postedAt},
        NOW(),
        ${JSON.stringify(post)}::jsonb
      )
      ON CONFLICT (post_id) DO UPDATE SET
        reposts = EXCLUDED.reposts,
        replies = EXCLUDED.replies,
        likes = EXCLUDED.likes,
        fetched_at = NOW()
    `;
    return true;
  } catch (err) {
    console.warn(`[threads] upsert ${postId} failed:`, err);
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
      hint: "Threads scraping é Pro+. Setar env var pra ativar.",
      dry: auth.isDry,
    });
  }

  if (process.env.THREADS_SCRAPE_DISABLED === "true") {
    return jsonResponse({
      ok: true,
      skipped: "THREADS_SCRAPE_DISABLED=true",
      hint: "Kill-switch específico de Threads ativo.",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const t0 = Date.now();

  // Migration on-demand (idempotente)
  try {
    await ensureThreadsPostsTable(sql);
  } catch (err) {
    return jsonResponse(
      { error: "migration failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const sources = await listIndividualUserThreadsSources(sql);

  if (auth.isDry) {
    return jsonResponse({
      ok: true,
      dry: true,
      user_handles: sources.length,
      sample: sources.slice(0, 5).map((s) => ({ user: s.user_id, handle: s.handle, niche: s.niche_slug, plan: s.plan })),
      apify_call: "ACTIVE (kill-switch: THREADS_SCRAPE_DISABLED)",
      duration_ms: Date.now() - t0,
    });
  }

  if (sources.length === 0) {
    await logCronRun(sql, {
      cronType: "scrape-threads",
      status: "skipped",
      errorMsg: "no_users_with_threads_sources",
    });
    return jsonResponse({
      ok: true,
      skipped: "Nenhum user com tracked_sources(platform=threads)",
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    await logCronRun(sql, {
      cronType: "scrape-threads",
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
    // Posts/handle por plano do user (free=3, pro=12, max=12). Cap pro
    // free é defesa contra esgotar token Apify com fontes de baixo
    // engajamento.
    const userPlan = userSources[0].plan;
    const postsPerHandle = userPlan === "free" ? 3 : 12;
    try {
      // Apify call REAL ativada (2026-05-08). Kill-switch:
      // THREADS_SCRAPE_DISABLED=true em env aborta sem chamar Apify.
      const data = await _realApifyCall(apifyKey, handles, postsPerHandle);

      let inserted = 0;
      for (const post of data) {
        // Mapeia post→source via username match
        const author = (post.user as { username?: string } | undefined)?.username
          ?? (post.username as string | undefined)
          ?? "";
        const source =
          userSources.find((s) => s.handle.toLowerCase() === author.toLowerCase()) ?? userSources[0];
        const ok = await upsertThreadsPost(sql, post, source);
        if (ok) inserted++;
      }

      totalInserted += inserted;
      results.push({
        user_id: userId,
        handles: handles.length,
        inserted,
        status: data.length === 0 ? "no_data" : "success",
      });

      await logCronRun(sql, {
        cronType: "scrape-threads",
        userId,
        postsAdded: inserted,
        status: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ user_id: userId, handles: handles.length, inserted: 0, status: `error: ${msg.slice(0, 80)}` });
      await logCronRun(sql, {
        cronType: "scrape-threads",
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
    apify_call: "ACTIVE (kill-switch: THREADS_SCRAPE_DISABLED)",
    results,
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
