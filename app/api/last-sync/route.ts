/**
 * GET /api/last-sync — retorna timestamps das últimas ingestões.
 *
 * Usado pelo Dashboard pra mostrar "atualizado há X" e dar ao user
 * confiança que o radar tá fresco. Lê apenas MAX(...) — barato.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const dbUrl = process.env.DATABASE_URL;

interface MaxRow {
  ts: string | null;
}

export async function GET() {
  if (!dbUrl) return NextResponse.json({ error: "DB ausente" }, { status: 503 });

  const sql = neon(dbUrl);
  try {
    // Schema real: news=fetched_at, ig=scraped_at, videos=last_seen_at,
    // briefs=generated_at. NÃO existem `created_at` nessas tabelas.
    const [news, ig, videos, brief] = (await Promise.all([
      sql`SELECT MAX(fetched_at)::text AS ts FROM news_articles`,
      sql`SELECT MAX(scraped_at)::text AS ts FROM instagram_posts`,
      sql`SELECT MAX(last_seen_at)::text AS ts FROM videos`,
      sql`SELECT MAX(generated_at)::text AS ts FROM daily_briefs`,
    ])) as unknown as [MaxRow[], MaxRow[], MaxRow[], MaxRow[]];

    const lastSync = {
      news: news[0]?.ts ?? null,
      instagram: ig[0]?.ts ?? null,
      youtube: videos[0]?.ts ?? null,
      brief: brief[0]?.ts ?? null,
    };

    // Latest = max entre os feeds raw (news/ig/yt). Brief é diário, separado.
    const candidates = [lastSync.news, lastSync.instagram, lastSync.youtube]
      .filter((x): x is string => Boolean(x))
      .sort();
    const latest = candidates.length > 0 ? candidates[candidates.length - 1] : null;

    return NextResponse.json({
      ...lastSync,
      latest,
    });
  } catch (err) {
    console.error("[/api/last-sync] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
