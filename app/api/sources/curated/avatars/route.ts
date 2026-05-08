/**
 * /api/sources/curated/avatars — batch resolve de avatar URL pras curadas.
 *
 * POST { keys: string[] } → { avatars: Record<key, string | null> }
 *
 * Cache: tabela `curated_avatars(curated_key PK, avatar_url, fetched_at)`.
 *  - Hit fresco (< 30 dias): devolve direto.
 *  - Hit stale ou miss: re-resolve via og:image, persiste e devolve.
 *  - Falha de resolve: persiste null com fetched_at — re-tenta após 7d
 *    (evita scrapear na cara dura toda renderização pra perfis impossíveis).
 *
 * Plataformas suportadas: instagram/youtube/tiktok/threads.
 * twitter/rss/newsletter retornam null (sem og:image confiável).
 *
 * Validação: cada key precisa existir em ALL_CURATED. Limite 100 keys/req.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";
import { ALL_CURATED, type CuratedSource } from "@/lib/sources-curated";
import { resolveSourceAvatar } from "@/lib/avatar-resolver";

export const runtime = "nodejs";
export const maxDuration = 30;

const FRESH_DAYS = 30;
const RETRY_NULL_DAYS = 7;
const MAX_KEYS_PER_REQUEST = 100;

interface AvatarRow {
  curated_key: string;
  avatar_url: string | null;
  fetched_at: string;
}

async function ensureTable(sql: ReturnType<typeof getSql>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS curated_avatars (
      curated_key TEXT PRIMARY KEY,
      avatar_url TEXT,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function isFresh(row: AvatarRow): boolean {
  const fetched = new Date(row.fetched_at).getTime();
  const ageMs = Date.now() - fetched;
  const cutoffDays = row.avatar_url ? FRESH_DAYS : RETRY_NULL_DAYS;
  return ageMs < cutoffDays * 24 * 60 * 60 * 1000;
}

function pickResolvable(c: CuratedSource): boolean {
  return ["instagram", "youtube", "tiktok", "threads"].includes(c.platform);
}

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  let body: { keys?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(body.keys)) {
    return NextResponse.json({ error: "keys: string[] obrigatório" }, { status: 400 });
  }
  const keys = (body.keys as unknown[])
    .filter((k): k is string => typeof k === "string")
    .slice(0, MAX_KEYS_PER_REQUEST);
  if (keys.length === 0) {
    return NextResponse.json({ avatars: {} });
  }

  const validSources = new Map<string, CuratedSource>();
  for (const c of ALL_CURATED) {
    if (keys.includes(c.key)) validSources.set(c.key, c);
  }
  // remove keys inválidas/desconhecidas
  const validKeys = Array.from(validSources.keys());

  const sql = getSql();
  await ensureTable(sql);

  // 1. Carrega cache existente
  const cached = (await sql`
    SELECT curated_key, avatar_url, fetched_at::text
      FROM curated_avatars
     WHERE curated_key = ANY(${validKeys})
  `) as unknown as AvatarRow[];
  const cacheMap = new Map<string, AvatarRow>();
  for (const row of cached) cacheMap.set(row.curated_key, row);

  // 2. Determina quais resolver agora
  const toResolve: CuratedSource[] = [];
  const result: Record<string, string | null> = {};
  for (const key of validKeys) {
    const c = validSources.get(key);
    if (!c) continue;
    const cached = cacheMap.get(key);
    if (cached && isFresh(cached)) {
      result[key] = cached.avatar_url;
      continue;
    }
    if (!pickResolvable(c)) {
      // Persiste null pra evitar scrape repetido em rss/newsletter/twitter
      result[key] = null;
      toResolve.push(c); // ainda persiste no DB, mas resolve = null
      continue;
    }
    toResolve.push(c);
  }

  // 3. Resolve em paralelo (max 8 concorrentes)
  const CONCURRENCY = 8;
  for (let i = 0; i < toResolve.length; i += CONCURRENCY) {
    const batch = toResolve.slice(i, i + CONCURRENCY);
    const resolved = await Promise.all(
      batch.map(async (c) => {
        if (!pickResolvable(c)) return { key: c.key, avatarUrl: null as string | null };
        try {
          const r = await resolveSourceAvatar(c.platform, c.handle);
          return { key: c.key, avatarUrl: r.avatarUrl };
        } catch {
          return { key: c.key, avatarUrl: null as string | null };
        }
      }),
    );
    for (const r of resolved) {
      result[r.key] = r.avatarUrl;
      try {
        await sql`
          INSERT INTO curated_avatars (curated_key, avatar_url, fetched_at)
          VALUES (${r.key}, ${r.avatarUrl}, NOW())
          ON CONFLICT (curated_key)
          DO UPDATE SET avatar_url = EXCLUDED.avatar_url,
                        fetched_at = EXCLUDED.fetched_at
        `;
      } catch (err) {
        console.warn("[curated-avatars] persist err", r.key, err);
      }
    }
  }

  return NextResponse.json({ avatars: result });
}
