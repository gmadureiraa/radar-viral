/**
 * /api/cron/scrape-tiktok — STUB. Plano Max only.
 *
 * Status: not_implemented_yet (2026-04-30)
 *
 * TODO próximo passo:
 *  1. Apify TikTok Scraper — actor `clockworks/free-tiktok-scraper` ou
 *     `clockworks/tiktok-scraper` (~$0.01/profile run, ~12 posts cada)
 *  2. Inputs: lista de tracked_sources WHERE platform='tiktok' AND user.plan='max'
 *  3. Output: salvar em tabela `tiktok_posts` (criar migration: post_id PK,
 *     handle, caption, plays, likes, shares, comments, video_url, posted_at,
 *     fetched_at, niche, user_id NULL=global)
 *  4. Cron schedule: vercel.json `0 11 * * *` (1h depois do refresh IG)
 *  5. Custo: 10 handles × $0.01 × 30 dias = $3/user/mês — encaixa na margem
 *     do Max R$149 (~$30 brutos)
 *
 * Por enquanto retorna 503 pra qualquer chamada — feature gate explícito.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      error: "not_implemented_yet",
      plan: "max",
      message:
        "TikTok scraping é exclusivo do plano Max. Integração Apify pendente — próxima sprint.",
      nextSteps: [
        "Integrar actor Apify clockworks/tiktok-scraper",
        "Criar tabela tiktok_posts (migration)",
        "Adicionar cron schedule em vercel.json",
      ],
    },
    { status: 503 },
  );
}

export async function POST() {
  return GET();
}
