/**
 * GET /api/data/twitter?niche=marketing&limit=60&offset=0&days=7
 *
 * Lista tweets do nicho. Lê `twitter_posts` populada pelo cron
 * `/api/cron/scrape-twitter` (Pro/Max only).
 *
 * Multi-tenant: retorna tweets do user logado OU globais (user_id IS NULL).
 *
 * Params:
 *   - niche (string, default 'marketing')
 *   - limit (default 60, cap 200)
 *   - offset (default 0, cap 5000)
 *   - days (default 7, max 90) — janela em dias baseada em posted_at
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface TwitterPostRow {
  tweet_id: string;
  account_handle: string;
  niche: string | null;
  niche_id: number | null;
  user_id: string | null;
  text: string | null;
  lang: string | null;
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  view_count: number;
  has_media: boolean;
  media_urls: string[] | null;
  is_quote: boolean;
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
  const limit = Math.min(200, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  const offset = Math.min(5000, Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0));
  const daysRaw = Number(url.searchParams.get("days") ?? 7);
  const days = Math.min(90, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));

  const sql = getSql();
  try {
    // Filtra por user próprio OR global (user_id IS NULL). Garante que um
    // user nunca veja tweets de outro user mas continue vendo dados
    // globais se houver no futuro.
    const rows = (await sql`
      SELECT tweet_id, account_handle, niche, niche_id, user_id,
             text, lang,
             retweet_count, reply_count, like_count, quote_count, view_count,
             has_media, media_urls, is_quote,
             posted_at::text, fetched_at::text
        FROM twitter_posts
       WHERE niche = ${niche}
         AND (user_id = ${auth.user.id} OR user_id IS NULL)
         AND (posted_at IS NULL OR posted_at >= NOW() - (${days} || ' days')::interval)
       ORDER BY posted_at DESC NULLS LAST
       LIMIT ${limit}
       OFFSET ${offset}
    `) as unknown as TwitterPostRow[];

    return NextResponse.json({ posts: rows });
  } catch (err) {
    console.error("[/api/data/twitter] failed:", err);
    return NextResponse.json(
      { error: process.env.VERCEL_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
