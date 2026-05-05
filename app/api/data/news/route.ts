/**
 * GET /api/data/news?niche=marketing&limit=60&hours=72
 *
 * Lê news_articles populados pelo cron `/api/cron/refresh` da v1.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";
import { classifyNewsArticle, type NewsKind } from "@/lib/news-classifier";

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
  /** Heurística: "news" = atualização concreta; "analysis" = opinião/listicle */
  kind?: NewsKind;
  /** Score do classificador (>=0 news, <0 analysis) */
  classifier_score?: number;
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
  // ?kind=news → só atualizações concretas; ?kind=analysis → só análise/opinião;
  // default (sem param) → tudo, mas ordenado com news primeiro.
  const kindParam = url.searchParams.get("kind") as "news" | "analysis" | null;

  const sql = getSql();
  try {
    // Pega pool maior do que `limit` antes de classificar — pra ter material
    // depois do filtro kind=news. Mínimo 2x limit, máx 200.
    const fetchSize = Math.min(200, Math.max(limit * 2, limit));
    const rawRows = (await sql`
      SELECT link, source_id, source_name, source_color, language,
             niche, category, title, description, thumbnail,
             pub_date::text
        FROM news_articles
       WHERE niche = ${niche}
         AND pub_date >= NOW() - (${hours} || ' hours')::interval
       ORDER BY pub_date DESC NULLS LAST
       LIMIT ${fetchSize}
    `) as unknown as NewsArticleRow[];

    // Classifica + ordena: news (kind=news) primeiro, depois por score desc,
    // depois por pub_date desc. Corte por kind se solicitado.
    const enriched = rawRows.map((r) => {
      const c = classifyNewsArticle({
        title: r.title,
        description: r.description,
        category: r.category,
        source_name: r.source_name,
      });
      return { ...r, kind: c.kind, classifier_score: c.score };
    });

    let filtered = enriched;
    if (kindParam === "news") {
      filtered = enriched.filter((r) => r.kind === "news");
    } else if (kindParam === "analysis") {
      filtered = enriched.filter((r) => r.kind === "analysis");
    }

    // Ordenação final: news primeiro (kind asc → "analysis" depois "news"
    // alfabético, então invertemos). Score desc dentro do mesmo kind.
    filtered.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "news" ? -1 : 1;
      }
      const sb = b.classifier_score ?? 0;
      const sa = a.classifier_score ?? 0;
      if (sa !== sb) return sb - sa;
      return (b.pub_date ?? "").localeCompare(a.pub_date ?? "");
    });

    return NextResponse.json({ articles: filtered.slice(0, limit) });
  } catch (err) {
    console.error("[/api/data/news] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
