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

export const runtime = "nodejs";

export interface UserSourceRow {
  id: number;
  platform: string;
  niche: string;
  handle: string;
  display_name: string | null;
  active: boolean;
  added_at: string;
  source: string | null;
}

const VALID_PLATFORMS = new Set([
  "instagram",
  "youtube",
  "rss",
  "newsletter",
  "linkedin",
  "twitter",
]);

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche");

  const sql = getSql();
  const rows = niche
    ? ((await sql`
        SELECT id, platform, niche, handle, display_name, active,
               added_at::text, source
          FROM tracked_sources
         WHERE user_id = ${auth.user.id}
           AND niche = ${niche}
         ORDER BY platform, handle
      `) as unknown as UserSourceRow[])
    : ((await sql`
        SELECT id, platform, niche, handle, display_name, active,
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

  const sql = getSql();
  try {
    const rows = (await sql`
      INSERT INTO tracked_sources
        (platform, niche, handle, display_name, active, source, user_id, added_at)
      VALUES (
        ${body.platform}, ${body.niche}, ${body.handle},
        ${body.displayName ?? null},
        ${body.active ?? true},
        ${"manual"},
        ${auth.user.id},
        NOW()
      )
      RETURNING id, platform, niche, handle, display_name, active,
                added_at::text, source
    `) as unknown as UserSourceRow[];
    return NextResponse.json({ source: rows[0] });
  } catch (err) {
    console.error("[/api/sources POST] failed:", err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
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

  const sql = getSql();
  try {
    const rows = (await sql`
      UPDATE tracked_sources
         SET handle       = COALESCE(${body.handle ?? null}, handle),
             display_name = COALESCE(${body.displayName ?? null}, display_name),
             active       = COALESCE(${
               body.active === undefined ? null : body.active
             }, active)
       WHERE id = ${body.id}
         AND user_id = ${auth.user.id}
       RETURNING id, platform, niche, handle, display_name, active,
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
          process.env.NODE_ENV === "production"
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
