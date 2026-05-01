/**
 * GET /api/data/saved — lista bookmarks do user.
 * POST /api/data/saved — cria.
 * DELETE /api/data/saved?platform=&refId= — remove.
 *
 * Lê tabela saved_items (criada pela v1).
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface SavedItemRow {
  id: number;
  user_id: string;
  platform: string;
  ref_id: string;
  niche_slug: string | null;
  title: string;
  thumbnail: string | null;
  source_url: string | null;
  note: string | null;
  saved_at: string;
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform"); // optional filter
  const sql = getSql();
  try {
    const rows = platform
      ? ((await sql`
          SELECT id, user_id, platform, ref_id, niche_slug, title, thumbnail,
                 source_url, note, saved_at::text
            FROM saved_items
           WHERE user_id = ${auth.user.id} AND platform = ${platform}
           ORDER BY saved_at DESC LIMIT 200
        `) as unknown as SavedItemRow[])
      : ((await sql`
          SELECT id, user_id, platform, ref_id, niche_slug, title, thumbnail,
                 source_url, note, saved_at::text
            FROM saved_items
           WHERE user_id = ${auth.user.id}
           ORDER BY saved_at DESC LIMIT 200
        `) as unknown as SavedItemRow[]);
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("[/api/data/saved GET] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  let body: {
    platform?: string;
    refId?: string;
    nicheSlug?: string;
    title?: string;
    thumbnail?: string;
    sourceUrl?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.platform || !body.refId || !body.title) {
    return NextResponse.json({ error: "platform, refId e title obrigatórios" }, { status: 400 });
  }

  const sql = getSql();
  try {
    await sql`
      INSERT INTO saved_items (user_id, platform, ref_id, niche_slug, title, thumbnail, source_url, note, saved_at)
      VALUES (
        ${auth.user.id}, ${body.platform}, ${body.refId},
        ${body.nicheSlug ?? null}, ${body.title},
        ${body.thumbnail ?? null}, ${body.sourceUrl ?? null}, ${body.note ?? null},
        NOW()
      )
      ON CONFLICT (user_id, platform, ref_id) DO UPDATE SET
        title = EXCLUDED.title,
        thumbnail = EXCLUDED.thumbnail,
        source_url = EXCLUDED.source_url,
        note = COALESCE(EXCLUDED.note, saved_items.note)
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/data/saved POST] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform");
  const refId = url.searchParams.get("refId");
  if (!platform || !refId) {
    return NextResponse.json({ error: "platform + refId obrigatórios" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    DELETE FROM saved_items
     WHERE user_id = ${auth.user.id} AND platform = ${platform} AND ref_id = ${refId}
  `;
  return NextResponse.json({ ok: true });
}
