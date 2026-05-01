/**
 * GET /api/data/videos?days=7&limit=60
 *
 * Lista vídeos recentes do feed YouTube. v1 popula `videos` table via cron
 * que lê RSS dos canais trackados. Filtro por categoria não mapeia 1-pra-1
 * com niche RV (videos table tem `category` própria) — frontend filtra.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface VideoRow {
  video_id: string;
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  country: string | null;
  category: string | null;
  title: string;
  thumbnail_url: string;
  published_at: string;
  link: string;
  first_seen_at: string;
  last_seen_at: string;
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days") ?? 7);
  const limitRaw = Number(url.searchParams.get("limit") ?? 60);
  const days = Math.min(60, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
  const limit = Math.min(120, Math.max(10, Number.isFinite(limitRaw) ? limitRaw : 60));

  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT video_id, channel_id, channel_name, channel_handle, country,
             category, title, thumbnail_url, published_at::text, link,
             first_seen_at::text, last_seen_at::text
        FROM videos
       WHERE published_at >= NOW() - (${days} || ' days')::interval
       ORDER BY published_at DESC NULLS LAST
       LIMIT ${limit}
    `) as unknown as VideoRow[];
    return NextResponse.json({ videos: rows });
  } catch (err) {
    console.error("[/api/data/videos] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
