/**
 * GET /api/brief?niche=marketing — retorna o brief diário mais recente.
 *
 * Reusa a tabela `daily_briefs` do Radar v1 (mesmo Neon DB). v2 não popula,
 * só lê — o cron `/api/cron/brief` da v1 continua sendo source of truth.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

const dbUrl = process.env.DATABASE_URL;

interface BriefRow {
  id: string;
  niche: string;
  brief_date: string;
  narratives: unknown;
  hot_topics: unknown;
  carousel_ideas: unknown;
  cross_pollination: unknown;
  model_used: string | null;
  cost_usd: string | null;
}

export async function GET(req: Request) {
  if (!dbUrl) return NextResponse.json({ error: "DB ausente" }, { status: 503 });

  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche") ?? "marketing";

  const sql = neon(dbUrl);
  try {
    const rows = (await sql`
      SELECT id::text, niche, brief_date::text, narratives, hot_topics,
             carousel_ideas, cross_pollination, model_used, cost_usd::text
        FROM daily_briefs
       WHERE niche = ${niche}
       ORDER BY brief_date DESC
       LIMIT 1
    `) as unknown as BriefRow[];

    if (rows.length === 0) {
      return NextResponse.json({ brief: null });
    }
    const r = rows[0];
    return NextResponse.json({
      brief: {
        brief_date: r.brief_date,
        narratives: r.narratives,
        hot_topics: r.hot_topics,
        carousel_ideas: r.carousel_ideas,
        cross_pollination: r.cross_pollination,
        model_used: r.model_used,
        cost_usd: r.cost_usd ? Number(r.cost_usd) : null,
      },
    });
  } catch (err) {
    console.error("[/api/brief] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
