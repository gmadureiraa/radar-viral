/**
 * GET /api/data/instagram/posts?niche=marketing&limit=60&hours=&sort=recent|top
 *
 * Lista posts do IG do nicho. Reusa a tabela `instagram_posts` populada
 * pela v1 (cron `/api/cron/refresh`).
 *
 * Params:
 * - sort=recent (default) → ordem `posted_at DESC`
 * - sort=top → ordem `likes DESC NULLS LAST` (top do dia/janela)
 * - hours=24|48|... → janela em horas baseada em `posted_at`. Sem param: sem filtro.
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
  const limit = Math.min(120, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  const sort = url.searchParams.get("sort") === "top" ? "top" : "recent";
  const hoursParam = url.searchParams.get("hours");
  const hours = hoursParam ? Math.min(720, Math.max(1, Number(hoursParam) || 0)) : null;

  const sql = getSql();
  try {
    let rows: InstagramPostRow[];
    if (sort === "top" && hours) {
      rows = (await sql`
        SELECT shortcode, account_handle, niche, type, caption, display_url,
               child_urls, video_url, likes, comments, views,
               hashtags, mentions, posted_at::text, scraped_at::text,
               transcribed_at::text
          FROM instagram_posts
         WHERE niche = ${niche}
           AND posted_at >= NOW() - (${hours} || ' hours')::interval
         ORDER BY likes DESC NULLS LAST
         LIMIT ${limit}
      `) as unknown as InstagramPostRow[];
    } else if (sort === "top") {
      rows = (await sql`
        SELECT shortcode, account_handle, niche, type, caption, display_url,
               child_urls, video_url, likes, comments, views,
               hashtags, mentions, posted_at::text, scraped_at::text,
               transcribed_at::text
          FROM instagram_posts
         WHERE niche = ${niche}
         ORDER BY likes DESC NULLS LAST
         LIMIT ${limit}
      `) as unknown as InstagramPostRow[];
    } else if (hours) {
      rows = (await sql`
        SELECT shortcode, account_handle, niche, type, caption, display_url,
               child_urls, video_url, likes, comments, views,
               hashtags, mentions, posted_at::text, scraped_at::text,
               transcribed_at::text
          FROM instagram_posts
         WHERE niche = ${niche}
           AND posted_at >= NOW() - (${hours} || ' hours')::interval
         ORDER BY posted_at DESC NULLS LAST
         LIMIT ${limit}
      `) as unknown as InstagramPostRow[];
    } else {
      rows = (await sql`
        SELECT shortcode, account_handle, niche, type, caption, display_url,
               child_urls, video_url, likes, comments, views,
               hashtags, mentions, posted_at::text, scraped_at::text,
               transcribed_at::text
          FROM instagram_posts
         WHERE niche = ${niche}
         ORDER BY posted_at DESC NULLS LAST
         LIMIT ${limit}
      `) as unknown as InstagramPostRow[];
    }
    return NextResponse.json({ posts: rows });
  } catch (err) {
    console.error("[/api/data/instagram/posts] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
