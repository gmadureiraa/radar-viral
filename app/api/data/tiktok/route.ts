/**
 * GET /api/data/tiktok?niche=marketing&limit=60&offset=0&days=7
 *
 * Lista posts TikTok do nicho ativo. Filtra por user_id próprio
 * (radar individual) OR user_id IS NULL (global/legacy).
 *
 * Tabela `tiktok_posts` populada por /api/cron/scrape-tiktok (Phase 1).
 *
 * Params:
 *  - niche (default 'marketing')
 *  - limit (3..120, default 60)
 *  - offset (default 0)
 *  - days (1..60, default 7) — janela em dias baseada em posted_at
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface TikTokPostRow {
  post_id: string;
  account_handle: string;
  niche: string | null;
  niche_id: number | null;
  user_id: string | null;
  caption: string | null;
  video_url: string | null;
  cover_url: string | null;
  music_name: string | null;
  plays: number;
  likes: number;
  shares: number;
  comments: number;
  hashtags: unknown;
  posted_at: string | null;
  fetched_at: string;
}

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche") ?? "marketing";
  const limitRaw = Number(url.searchParams.get("limit") ?? 60);
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  const daysRaw = Number(url.searchParams.get("days") ?? 7);

  const limit = Math.min(120, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
  const days = Math.min(60, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));

  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT post_id, account_handle, niche, niche_id, user_id,
             caption, video_url, cover_url, music_name,
             plays, likes, shares, comments, hashtags,
             posted_at::text, fetched_at::text
        FROM tiktok_posts
       WHERE niche = ${niche}
         AND (user_id = ${auth.user.id} OR user_id IS NULL)
         AND posted_at >= NOW() - (${days} || ' days')::interval
       ORDER BY posted_at DESC NULLS LAST
       LIMIT ${limit}
      OFFSET ${offset}
    `) as unknown as TikTokPostRow[];
    return NextResponse.json({ posts: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("does not exist") || msg.includes("relation")) {
      return NextResponse.json({ posts: [] });
    }
    console.error("[/api/data/tiktok] failed:", err);
    return NextResponse.json(
      { error: process.env.VERCEL_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
