/**
 * GET /api/data/instagram/posts?niche=marketing&limit=60
 *
 * Lista posts do IG do nicho ordenados por posted_at desc. Reusa a tabela
 * `instagram_posts` populada pela v1 (cron `/api/cron/refresh`).
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface InstagramPostRow {
  shortcode: string;
  account_handle: string;
  niche: string;
  type: string | null;
  caption: string | null;
  display_url: string | null;
  child_urls: string[] | null;
  video_url: string | null;
  likes: number;
  comments: number;
  views: number;
  hashtags: string[] | null;
  mentions: string[] | null;
  posted_at: string | null;
  scraped_at: string;
  transcribed_at?: string | null;
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
  const limit = Math.min(120, Math.max(10, Number.isFinite(limitRaw) ? limitRaw : 60));

  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT shortcode, account_handle, niche, type, caption, display_url,
             child_urls, video_url, likes, comments, views,
             hashtags, mentions, posted_at::text, scraped_at::text,
             transcribed_at::text
        FROM instagram_posts
       WHERE niche = ${niche}
       ORDER BY posted_at DESC NULLS LAST
       LIMIT ${limit}
    `) as unknown as InstagramPostRow[];
    return NextResponse.json({ posts: rows });
  } catch (err) {
    console.error("[/api/data/instagram/posts] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
