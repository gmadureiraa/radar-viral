/**
 * Radar Viral — Planos e limites.
 *
 * Moeda: BRL. Stripe BR aceita BRL nativo.
 * Mesma conta Stripe do RV/SV — diferenciamos via metadata.app='radar'.
 *
 * Diferença de modelo vs Reels Viral:
 * - RV cobra por geração (custo Apify+Gemini por reel adaptado)
 * - Radar cobra por radar individual (cron próprio popula DB pra esse user)
 *
 * Custo por user Pro/mês (medido via DB em 2026-04-29):
 *   Apify Instagram scrape: ~$0.000346 por post real
 *     6 IG handles × ~30 posts/run × 30 runs/mês = 5.400 posts
 *     5.400 × $0.000346 = ~$1.87/mês (cap em 6 handles ajuda muito)
 *   YouTube RSS: $0 (RSS gratuito)
 *   News RSS: $0 (RSS gratuito)
 *   Gmail (newsletters): $0 (user-side, com cap quota free)
 *   Brief IA Gemini Flash: ~$0.0001 por brief × 30 briefs = ~$0.003/mês
 *   Storage Neon + compute Vercel: rateado, < $0.10/user
 *   TOTAL: ~$2 USD/mês ≈ R$ 10
 *
 * Plano Pro R$ 49,90 → margem ~80% (R$ 40 líquido por user)
 * Stripe BR: ~3,99% + R$ 0,40 por transação = ~R$ 2,40 deduzido
 * Margem real: ~R$ 37,50 por user/mês = 75% líquido
 *
 * Plano Max R$ 149/mês: cap 15 IG + 8 YT + 10 TikTok + 2 nichos +
 * agente IA chat por nicho. Custo estimado ~$8-10/mês user (TikTok Apify
 * actor adiciona ~$3-5, mais nichos = mais scrapes). Margem ~85% bruta.
 */

export const PLAN_CURRENCY = "brl" as const;

export const PLANS_RDV = {
  free: {
    name: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    /** Free vê o radar global (popped from shared sources). Sem cron individual. */
    individualCron: false,
    maxNiches: 0,
    igHandlesCap: 0,
    ytChannelsCap: 0,
    rssNewsCap: 0,
    newslettersCap: 0,
    tiktokHandlesCap: 0,
    /** Briefs IA mensais (sentinel: -1 = ilimitado) */
    briefsMonthlyCap: 0,
    /** Agente IA chat por nicho (Max only) */
    aiChatAgent: false,
    /** Stripe Product ID (placeholder por enquanto, inline price_data via product_data) */
    stripeProductId: null as string | null,
    features: [
      "Radar global compartilhado (Brief IA + Temas)",
      "Acesso à curadoria de fontes do teu nicho (read-only)",
      "Salvar/bookmark cross-platform",
      "Bridges com Sequência Viral e Reels Viral",
    ],
  },
  pro: {
    name: "Pro",
    priceMonthly: 4990, // R$ 49,90 em centavos BRL
    priceAnnual: 47904, // R$ 479,04 (-20% sobre 49.90×12 = 598.80)
    priceAnchor: 9990, // de R$ 99,90
    /** Pro ativa cron individual: tracked_sources com user_id próprio. */
    individualCron: true,
    maxNiches: 1,
    igHandlesCap: 6,
    ytChannelsCap: 3,
    rssNewsCap: 6,
    newslettersCap: 5,
    tiktokHandlesCap: 0,
    briefsMonthlyCap: 30,
    aiChatAgent: false,
    stripeProductId: null as string | null,
    features: [
      "✓ Tudo do Free",
      "Radar individual (não compartilhado): suas fontes, seu DB",
      "Até 6 handles IG · 3 canais YouTube · 6 RSS · 5 newsletters",
      "Cron diário scrapando pra você",
      "Brief IA personalizado pelo seu nicho (read-only)",
      "Suporte por email",
    ],
  },
  max: {
    name: "Max",
    priceMonthly: 14900, // R$ 149,00
    priceAnnual: 143040, // R$ 1.430,40 (-20% sobre 149×12 = 1788)
    priceAnchor: 24900, // de R$ 249,00
    /** Max também tem cron individual, com cap maior. */
    individualCron: true,
    maxNiches: 2,
    igHandlesCap: 15,
    ytChannelsCap: 8,
    rssNewsCap: 15,
    newslettersCap: 12,
    tiktokHandlesCap: 10,
    /** Briefs IA ilimitados (sentinel -1) */
    briefsMonthlyCap: -1,
    aiChatAgent: true,
    // TODO Stripe BR Dashboard:
    //  1. Products → Create Product → "Radar Viral — Max"
    //  2. Add Price R$ 149,00 BRL recurring monthly
    //  3. Add Price R$ 1.430,40 BRL recurring yearly (-20%)
    //  4. Copiar Product ID + Price IDs e setar:
    //     - PLANS_RDV.max.stripeProductId
    //     - env STRIPE_PRICE_ID_MAX_MONTHLY
    //     - env STRIPE_PRICE_ID_MAX_YEARLY
    stripeProductId: "prod_TODO_MAX" as string | null,
    features: [
      "✓ Tudo do Pro",
      "2 nichos simultâneos (Pro tem 1)",
      "Até 15 IG · 8 YouTube · 10 TikTok · 15 RSS · 12 newsletters",
      "TikTok scraping (exclusivo Max)",
      "Briefs IA ilimitados",
      "Agente IA conversacional dedicado por nicho",
      "Suporte prioritário",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS_RDV;

export const DEFAULT_PLAN: PlanId = "free";

export function hasIndividualCron(plan: PlanId): boolean {
  return PLANS_RDV[plan].individualCron;
}

/** Plano paid (não-free)? */
export function isPaidPlan(plan: PlanId): boolean {
  return plan !== "free";
}

/** Caps do plano por platform — usar isso ao invés de PLANS_RDV.pro hardcoded. */
export function getPlanCapForPlatform(
  plan: PlanId,
  platform: string,
): number | null {
  const p = PLANS_RDV[plan];
  switch (platform) {
    case "instagram":
      return p.igHandlesCap;
    case "youtube":
      return p.ytChannelsCap;
    case "rss":
    case "news_rss":
      return p.rssNewsCap;
    case "newsletter":
    case "newsletter_subscribe":
      return p.newslettersCap;
    case "tiktok":
      return p.tiktokHandlesCap;
    default:
      return null;
  }
}

/** Briefs IA mensais (com sentinel -1 = ilimitado, retorna Infinity). */
export function usageLimitForPaidPlan(plan: PlanId): number {
  const cap = PLANS_RDV[plan].briefsMonthlyCap;
  return cap < 0 ? Infinity : cap;
}
