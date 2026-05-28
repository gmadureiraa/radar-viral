/**
 * GET /api/data/trends?niche=marketing&days=7
 *
 * Página de Tendências — agrega padrões da janela (default 7 dias) sobre a
 * tabela `instagram_posts` que a v1 já popula. ZERO scrape novo, zero custo:
 * só leitura + agregação no Postgres.
 *
 * Retorna:
 *  - hashtags: top hashtags por frequência + engajamento total
 *  - accounts: contas que mais bombaram (média de engajamento na janela)
 *  - formats: distribuição reel / carrossel / imagem (count + média de likes)
 *  - hours: melhores horários de publicação (BRT) por engajamento médio
 *  - summary: totais da janela (posts, contas, engajamento)
 *
 * Tudo derivado de dados existentes. Window param clampado 1..30 dias.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface TrendHashtag {
  tag: string;
  posts: number;
  total_engagement: number;
  avg_engagement: number;
}

export interface TrendAccount {
  account_handle: string;
  posts: number;
  total_engagement: number;
  avg_engagement: number;
  top_likes: number;
}

export interface TrendFormat {
  format: "reel" | "carousel" | "image";
  posts: number;
  avg_likes: number;
  avg_engagement: number;
}

export interface TrendHour {
  hour: number; // 0-23 BRT
  posts: number;
  avg_engagement: number;
}

export interface TrendsResponse {
  niche: string;
  days: number;
  summary: { posts: number; accounts: number; total_engagement: number };
  hashtags: TrendHashtag[];
  accounts: TrendAccount[];
  formats: TrendFormat[];
  hours: TrendHour[];
}

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche") ?? "marketing";
  const daysRaw = Number(url.searchParams.get("days") ?? 7);
  const days = Math.min(30, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));

  const sql = getSql();
  try {
    // Engajamento = likes + comments. Views fica de fora por ser ruidoso
    // (só reels têm, e infla muito a média). posted_at pode ser null em
    // posts antigos — filtra fora da janela.
    const [hashtagsRaw, accountsRaw, formatsRaw, hoursRaw, summaryRaw] =
      await Promise.all([
        // Top hashtags: explode o array jsonb, agrupa lowercased.
        sql`
          SELECT lower(tag) AS tag,
                 COUNT(*)::int AS posts,
                 SUM(p.likes + p.comments)::bigint AS total_engagement
            FROM instagram_posts p,
                 LATERAL jsonb_array_elements_text(
                   CASE WHEN jsonb_typeof(p.hashtags) = 'array'
                        THEN p.hashtags ELSE '[]'::jsonb END
                 ) AS tag
           WHERE p.niche = ${niche}
             AND p.posted_at >= NOW() - (${days} || ' days')::interval
             AND length(trim(tag)) > 0
           GROUP BY lower(tag)
           ORDER BY posts DESC, total_engagement DESC
           LIMIT 20
        `,
        // Contas em alta: média de engajamento na janela.
        sql`
          SELECT account_handle,
                 COUNT(*)::int AS posts,
                 SUM(likes + comments)::bigint AS total_engagement,
                 MAX(likes)::bigint AS top_likes
            FROM instagram_posts
           WHERE niche = ${niche}
             AND posted_at >= NOW() - (${days} || ' days')::interval
           GROUP BY account_handle
           ORDER BY (SUM(likes + comments) / GREATEST(COUNT(*), 1)) DESC
           LIMIT 12
        `,
        // Distribuição por formato. Reel = type Video ou tem video_url.
        // Carrossel = child_urls com 2+. Resto = imagem.
        sql`
          SELECT CASE
                   WHEN type = 'Video' OR (video_url IS NOT NULL AND video_url <> '') THEN 'reel'
                   WHEN jsonb_typeof(child_urls) = 'array'
                        AND jsonb_array_length(child_urls) > 1 THEN 'carousel'
                   ELSE 'image'
                 END AS format,
                 COUNT(*)::int AS posts,
                 AVG(likes)::bigint AS avg_likes,
                 AVG(likes + comments)::bigint AS avg_engagement
            FROM instagram_posts
           WHERE niche = ${niche}
             AND posted_at >= NOW() - (${days} || ' days')::interval
           GROUP BY 1
           ORDER BY posts DESC
        `,
        // Melhores horários (convertido pra BRT = UTC-3).
        sql`
          SELECT EXTRACT(HOUR FROM (posted_at AT TIME ZONE 'America/Sao_Paulo'))::int AS hour,
                 COUNT(*)::int AS posts,
                 AVG(likes + comments)::bigint AS avg_engagement
            FROM instagram_posts
           WHERE niche = ${niche}
             AND posted_at >= NOW() - (${days} || ' days')::interval
           GROUP BY 1
           ORDER BY avg_engagement DESC
           LIMIT 24
        `,
        sql`
          SELECT COUNT(*)::int AS posts,
                 COUNT(DISTINCT account_handle)::int AS accounts,
                 COALESCE(SUM(likes + comments), 0)::bigint AS total_engagement
            FROM instagram_posts
           WHERE niche = ${niche}
             AND posted_at >= NOW() - (${days} || ' days')::interval
        `,
      ]);

    const hashtags: TrendHashtag[] = (
      hashtagsRaw as unknown as Array<{
        tag: string;
        posts: number;
        total_engagement: number;
      }>
    ).map((r) => ({
      tag: r.tag,
      posts: Number(r.posts),
      total_engagement: Number(r.total_engagement),
      avg_engagement: Math.round(Number(r.total_engagement) / Math.max(Number(r.posts), 1)),
    }));

    const accounts: TrendAccount[] = (
      accountsRaw as unknown as Array<{
        account_handle: string;
        posts: number;
        total_engagement: number;
        top_likes: number;
      }>
    ).map((r) => ({
      account_handle: r.account_handle,
      posts: Number(r.posts),
      total_engagement: Number(r.total_engagement),
      avg_engagement: Math.round(Number(r.total_engagement) / Math.max(Number(r.posts), 1)),
      top_likes: Number(r.top_likes),
    }));

    const formats: TrendFormat[] = (
      formatsRaw as unknown as Array<{
        format: TrendFormat["format"];
        posts: number;
        avg_likes: number;
        avg_engagement: number;
      }>
    ).map((r) => ({
      format: r.format,
      posts: Number(r.posts),
      avg_likes: Number(r.avg_likes),
      avg_engagement: Number(r.avg_engagement),
    }));

    const hours: TrendHour[] = (
      hoursRaw as unknown as Array<{
        hour: number;
        posts: number;
        avg_engagement: number;
      }>
    )
      .map((r) => ({
        hour: Number(r.hour),
        posts: Number(r.posts),
        avg_engagement: Number(r.avg_engagement),
      }))
      .filter((r) => Number.isFinite(r.hour));

    const summaryRow = (summaryRaw as unknown as Array<{
      posts: number;
      accounts: number;
      total_engagement: number;
    }>)[0] ?? { posts: 0, accounts: 0, total_engagement: 0 };

    const payload: TrendsResponse = {
      niche,
      days,
      summary: {
        posts: Number(summaryRow.posts),
        accounts: Number(summaryRow.accounts),
        total_engagement: Number(summaryRow.total_engagement),
      },
      hashtags,
      accounts,
      formats,
      hours,
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[/api/data/trends] failed:", err);
    return NextResponse.json(
      { error: process.env.VERCEL_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
