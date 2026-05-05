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

/**
 * Decisão 2026-05-05: simplificar pra 2 planos (Free + Pro). Max foi
 * consolidado dentro do Pro: caps maiores, briefs ilimitados, agente IA
 * chat. Preço Pro saltou de R$ 49,90 pra R$ 99,90 (entre Pro antigo e
 * Max antigo) reflete o aumento de features + custo de TikTok scraping.
 *
 * Max permanece no enum APENAS pra grandfathering: users que tem subscription
 * ativa em `plan='max'` no DB continuam com features Max e preço Stripe
 * antigo (R$ 149) até cancelarem. Webhook respeita. UI /app/precos não
 * mostra Max — esses users acessam via portal pra cancelar/gerenciar.
 *
 * Novos users veem só Free e Pro.
 */
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
    /** Agente IA chat por nicho (Pro only) */
    aiChatAgent: false,
    /** Stripe Product ID (placeholder por enquanto, inline price_data via product_data) */
    stripeProductId: null as string | null,
    /** Hidden da UI /app/precos? Free é sempre visível. */
    hidden: false,
    features: [
      "Radar global compartilhado (Brief IA + Temas)",
      "Acesso à curadoria de fontes do teu nicho (read-only)",
      "Salvar/bookmark cross-platform",
      "Bridges com Sequência Viral e Reels Viral",
    ],
  },
  pro: {
    name: "Pro",
    priceMonthly: 9990, // R$ 99,90 em centavos BRL (consolidado, era 49,90)
    priceAnnual: 95904, // R$ 959,04/ano (-20% sobre 99,90×12 = 1198,80)
    priceAnchor: 14900, // de R$ 149,00 (preço de Max anterior)
    /** Pro ativa cron individual: tracked_sources com user_id próprio. */
    individualCron: true,
    maxNiches: 2,
    igHandlesCap: 15,
    ytChannelsCap: 8,
    rssNewsCap: 15,
    newslettersCap: 12,
    tiktokHandlesCap: 10,
    /** Briefs IA ilimitados (sentinel -1) */
    briefsMonthlyCap: -1,
    /** Agente IA chat conversacional por nicho */
    aiChatAgent: true,
    stripeProductId: null as string | null,
    hidden: false,
    features: [
      "✓ Tudo do Free",
      "Radar individual: suas fontes, seu DB, cron diário próprio",
      "Até 2 nichos simultâneos",
      "15 handles IG · 8 canais YouTube · 10 TikTok · 15 RSS · 12 newsletters",
      "TikTok scraping incluído",
      "Brief IA ilimitado e personalizado pelo seu nicho",
      "Agente IA conversacional dedicado por nicho",
      "Suporte por email",
    ],
  },
  /**
   * DEPRECATED — não aparece em /app/precos. Mantido só pra users
   * grandfathered com subscription ativa em plan='max' (preço antigo
   * R$ 149/mês, prod_USgl567rf0sO0n). Quando cancelarem, viram free.
   * Features são as mesmas do Pro novo (foram consolidadas) — então
   * downgrade não dói nada operacionalmente.
   */
  max: {
    name: "Max",
    priceMonthly: 14900, // R$ 149,00 (preço grandfathered, NÃO usado em checkout novo)
    priceAnnual: 143040,
    priceAnchor: 24900,
    individualCron: true,
    maxNiches: 2,
    igHandlesCap: 15,
    ytChannelsCap: 8,
    rssNewsCap: 15,
    newslettersCap: 12,
    tiktokHandlesCap: 10,
    briefsMonthlyCap: -1,
    aiChatAgent: true,
    // Stripe BR (criado em 2026-05-05, mantido pra subs grandfathered):
    //   Product:  prod_USgl567rf0sO0n
    //   Monthly:  price_1TTlNfGhC9Vkt84YiwiE37mQ
    //   Yearly:   price_1TTlNnGhC9Vkt84YvSvE20Gx
    stripeProductId: "prod_USgl567rf0sO0n" as string | null,
    /** Esconde da UI /app/precos. Webhook continua aceitando pra grandfathering. */
    hidden: true,
    features: [
      "✓ Tudo do Pro",
      "Plano legado — não disponível pra novas assinaturas",
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
