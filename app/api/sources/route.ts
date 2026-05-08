/**
 * /api/sources — CRUD em tracked_sources do user logado.
 *
 *  - GET: lista fontes do user (filtradas por niche se passar ?niche=)
 *  - POST: cria nova fonte { platform, niche, handle, label, active }
 *  - PATCH: atualiza fonte por id { id, ...updates }
 *  - DELETE: remove fonte ?id=N
 *
 * Apenas o próprio user pode mexer nas suas fontes (WHERE user_id = auth.user.id).
 * Fontes globais (user_id IS NULL) não podem ser editadas via essa API.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";
import { getUserSubscription } from "@/lib/subscriptions";
import {
  getPlanCapForPlatform,
  getMaxTotalSources,
  canEditHandle,
} from "@/lib/pricing";
import { resolveYouTubeChannelId } from "@/lib/youtube-channels";
import { resolveSourceAvatar } from "@/lib/avatar-resolver";

/**
 * Garante que `tracked_sources.avatar_url` existe. Idempotente, on-demand.
 * Chamar nos pontos que precisam (GET pra ler, POST pra escrever).
 */
async function ensureAvatarColumn(
  sql: ReturnType<typeof getSql>,
): Promise<void> {
  try {
    await sql`ALTER TABLE tracked_sources ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  } catch (err) {
    console.warn("[/api/sources] ensureAvatarColumn failed (swallowed):", err);
  }
}

export const runtime = "nodejs";

export interface UserSourceRow {
  id: number;
  platform: string;
  niche: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  active: boolean;
  added_at: string;
  source: string | null;
}

const VALID_PLATFORMS = new Set([
  "instagram",
  "youtube",
  "threads",
  "tiktok",
  "twitter",
  "rss",
  "newsletter",
  "linkedin",
]);

/**
 * Platforms exclusivas de planos avançados (não-Pro).
 *
 * Vazio desde 2026-05-08: o Pro novo (R$ 99,90) consolidou Max e cobre
 * TikTok via tiktokHandlesCap=10. Manter o tipo aqui pra ressuscitar
 * fácil se algum dia a gente precisar reservar plataforma pra tier maior.
 */
const PLATFORM_MIN_PLAN: Record<string, "pro" | "max"> = {};

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche");

  const sql = getSql();
  await ensureAvatarColumn(sql);
  const rows = niche
    ? ((await sql`
        SELECT id, platform, niche, handle, display_name, avatar_url, active,
               added_at::text, source
          FROM tracked_sources
         WHERE user_id = ${auth.user.id}
           AND niche = ${niche}
         ORDER BY platform, handle
      `) as unknown as UserSourceRow[])
    : ((await sql`
        SELECT id, platform, niche, handle, display_name, avatar_url, active,
               added_at::text, source
          FROM tracked_sources
         WHERE user_id = ${auth.user.id}
         ORDER BY niche, platform, handle
      `) as unknown as UserSourceRow[]);

  return NextResponse.json({ sources: rows });
}

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  let body: {
    platform?: string;
    niche?: string;
    handle?: string;
    displayName?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.platform || !body.niche || !body.handle) {
    return NextResponse.json(
      { error: "platform, niche e handle obrigatórios" },
      { status: 400 },
    );
  }
  if (!VALID_PLATFORMS.has(body.platform)) {
    return NextResponse.json(
      { error: `platform inválida (${[...VALID_PLATFORMS].join(", ")})` },
      { status: 400 },
    );
  }

  // ── Plan + quota guards ─────────────────────────────────────────────
  // 2026-05-08: Free agora também adiciona (cap 3 total). Pro até 60.
  const sub = await getUserSubscription(auth.user.id);

  // Platforms exclusivas (ex: tiktok só no Max — vazio hoje, mantido pra fence)
  const minPlan = PLATFORM_MIN_PLAN[body.platform];
  if (minPlan === "max" && sub.plan !== "max") {
    return NextResponse.json(
      {
        error: `${body.platform} é exclusivo do plano Max. Faça upgrade pra desbloquear.`,
        upgradeRequired: true,
        requiresPlan: "max",
      },
      { status: 403 },
    );
  }

  const sql = getSql();

  // Cap GLOBAL — soma de fontes em todas plataformas. É o cap real do user.
  const totalCap = getMaxTotalSources(sub.plan);
  const totalRows = (await sql`
    SELECT COUNT(*)::int AS n
      FROM tracked_sources
     WHERE user_id = ${auth.user.id}
  `) as unknown as Array<{ n: number }>;
  const totalCurrent = totalRows[0]?.n ?? 0;
  if (totalCurrent >= totalCap) {
    const planLabel = sub.plan === "free" ? "Free" : sub.plan === "max" ? "Max" : "Pro";
    return NextResponse.json(
      {
        error: sub.plan === "free"
          ? `Limite Free atingido (${totalCurrent}/${totalCap} fontes). Remova alguma ou faça upgrade pro Pro.`
          : `Limite ${planLabel} atingido (${totalCurrent}/${totalCap}). Remova fontes ou faça upgrade.`,
        capReached: true,
        scope: "total",
        cap: totalCap,
        current: totalCurrent,
        upgradeRequired: sub.plan === "free",
      },
      { status: 403 },
    );
  }

  // Cap por platform (defesa: free tem 3 em cada, Pro 8-15. UI pode usar
  // pra mostrar limite específico).
  const cap = getPlanCapForPlatform(sub.plan, body.platform);
  if (cap !== null && cap > 0) {
    const countRows = (await sql`
      SELECT COUNT(*)::int AS n
        FROM tracked_sources
       WHERE user_id = ${auth.user.id}
         AND platform = ${body.platform}
    `) as unknown as Array<{ n: number }>;
    const current = countRows[0]?.n ?? 0;
    if (current >= cap) {
      const planLabel = sub.plan === "max" ? "Max" : sub.plan === "pro" ? "Pro" : "Free";
      return NextResponse.json(
        {
          error: `Limite ${planLabel} atingido pra ${body.platform} (${current}/${cap}). Remova alguma fonte pra adicionar outra.`,
          capReached: true,
          platform: body.platform,
          cap,
          current,
        },
        { status: 403 },
      );
    }
  }

  // ── YouTube handle → channelId resolution ────────────────────────────
  // Cron individual lê `tracked_sources.handle` esperando formato `UC...`
  // (channelId canônico). Se o user colou `@handle`, resolvemos antes do
  // INSERT — senão o cron skipa silencioso e o user fica sem feed.
  let resolvedHandle = body.handle;
  let resolvedDisplayName = body.displayName ?? null;
  if (body.platform === "youtube") {
    const resolution = await resolveYouTubeChannelId(body.handle);
    if (!resolution) {
      return NextResponse.json(
        {
          error:
            "Não consegui resolver esse canal do YouTube. Confirma o handle (ex: @canalexemplo) ou cole o channelId direto (UC...).",
          resolutionFailed: true,
        },
        { status: 400 },
      );
    }
    resolvedHandle = resolution.channelId;
    if (!resolvedDisplayName && resolution.channelName) {
      resolvedDisplayName = resolution.channelName;
    }
  }

  // ── Avatar resolution (best-effort, não bloqueia INSERT) ─────────────
  // Pra IG/YT/TikTok/Threads tenta scrape do og:image. Se falhar, fica
  // null e UI usa fallback (inicial estilizada). X/Twitter sempre null.
  let avatarUrl: string | null = null;
  try {
    const av = await resolveSourceAvatar(
      body.platform,
      body.platform === "youtube" ? body.handle : resolvedHandle,
    );
    avatarUrl = av.avatarUrl;
    if (!resolvedDisplayName && av.displayName) {
      resolvedDisplayName = av.displayName;
    }
  } catch {
    /* avatar é opcional, não bloqueia criação */
  }

  await ensureAvatarColumn(sql);

  try {
    const rows = (await sql`
      INSERT INTO tracked_sources
        (platform, niche, handle, display_name, avatar_url, active, source, user_id, added_at)
      VALUES (
        ${body.platform}, ${body.niche}, ${resolvedHandle},
        ${resolvedDisplayName},
        ${avatarUrl},
        ${body.active ?? true},
        ${"manual"},
        ${auth.user.id},
        NOW()
      )
      RETURNING id, platform, niche, handle, display_name, avatar_url, active,
                added_at::text, source
    `) as unknown as UserSourceRow[];
    return NextResponse.json({ source: rows[0] });
  } catch (err) {
    console.error("[/api/sources POST] failed:", err);
    return NextResponse.json(
      {
        error:
          process.env.VERCEL_ENV === "production"
            ? "Falha ao criar fonte"
            : String(err),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  let body: {
    id?: number;
    handle?: string;
    displayName?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  // Free user não pode trocar handle (anti-rotação que queima Apify).
  // displayName + active livres. Pro/Max liberados em tudo.
  const subForPatch = await getUserSubscription(auth.user.id);
  const handleEditAllowed = canEditHandle(subForPatch.plan);
  const handleToWrite = handleEditAllowed ? body.handle ?? null : null;
  if (!handleEditAllowed && body.handle) {
    return NextResponse.json(
      {
        error: "Free não pode trocar handle. Pra mudar, exclua e adicione novo. Faça upgrade pro Pro pra editar livremente.",
        handleEditBlocked: true,
        upgradeRequired: true,
      },
      { status: 403 },
    );
  }

  const sql = getSql();
  await ensureAvatarColumn(sql);
  try {
    const rows = (await sql`
      UPDATE tracked_sources
         SET handle       = COALESCE(${handleToWrite}, handle),
             display_name = COALESCE(${body.displayName ?? null}, display_name),
             active       = COALESCE(${
               body.active === undefined ? null : body.active
             }, active)
       WHERE id = ${body.id}
         AND user_id = ${auth.user.id}
       RETURNING id, platform, niche, handle, display_name, avatar_url, active,
                 added_at::text, source
    `) as unknown as UserSourceRow[];
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Fonte não encontrada ou não é sua." },
        { status: 404 },
      );
    }
    return NextResponse.json({ source: rows[0] });
  } catch (err) {
    console.error("[/api/sources PATCH] failed:", err);
    return NextResponse.json(
      {
        error:
          process.env.VERCEL_ENV === "production"
            ? "Falha ao atualizar"
            : String(err),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const idRaw = url.searchParams.get("id");
  const id = idRaw ? Number(idRaw) : null;
  if (!id || !Number.isFinite(id)) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const sql = getSql();
  const rows = (await sql`
    DELETE FROM tracked_sources
     WHERE id = ${id}
       AND user_id = ${auth.user.id}
     RETURNING id
  `) as unknown as Array<{ id: number }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Fonte não encontrada ou não é sua." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
