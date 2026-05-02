/**
 * GET /api/data/news?niche=marketing&limit=60&hours=72
 *
 * Lê news_articles populados pelo cron `/api/cron/refresh` da v1.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface NewsArticleRow {
  link: string;
  source_id: string | null;
  source_name: string | null;
  source_color: string | null;
  language: string | null;
  niche: string;
  category: string | null;
  title: string;
  description: string | null;
  thumbnail: string | null;
  pub_date: string | null;
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche") ?? "marketing";
  const limitRaw = Number(url.searchParams.get("limit") ?? 60);
  const hoursRaw = Number(url.searchParams.get("hours") ?? 72);
  const limit = Math.min(120, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  const hours = Math.min(720, Math.max(6, Number.isFinite(hoursRaw) ? hoursRaw : 72));

  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT link, source_id, source_name, source_color, language,
             niche, category, title, description, thumbnail,
             pub_date::text
        FROM news_articles
       WHERE niche = ${niche}
         AND pub_date >= NOW() - (${hours} || ' hours')::interval
       ORDER BY pub_date DESC NULLS LAST
       LIMIT ${limit}
    `) as unknown as NewsArticleRow[];
    return NextResponse.json({ articles: rows });
  } catch (err) {
    console.error("[/api/data/news] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
