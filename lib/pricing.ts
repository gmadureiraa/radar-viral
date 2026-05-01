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
 * Conclusão: Pro R$ 49,90 está MUITO bem precificado. Espaço pra criar Pro+
 * (cap maior + suporte premium) em R$ 99,90 mais à frente.
 */

export const PLAN_CURRENCY = "brl" as const;

export const PLANS_RDV = {
  free: {
    name: "Free",
    priceMonthly: 0,
    /** Free vê o radar global (popped from shared sources). Sem cron individual. */
    individualCron: false,
    igHandlesCap: 0,
    ytChannelsCap: 0,
    rssNewsCap: 0,
    newslettersCap: 0,
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
    priceAnchor: 9990, // de R$ 99,90
    /** Pro ativa cron individual: tracked_sources com user_id próprio. */
    individualCron: true,
    igHandlesCap: 6,
    ytChannelsCap: 3,
    rssNewsCap: 6,
    newslettersCap: 5,
    features: [
      "✓ Tudo do Free",
      "Radar individual (não compartilhado): suas fontes, seu DB",
      "Até 6 handles IG · 3 canais YouTube · 6 RSS · 5 newsletters",
      "Cron diário scrapando pra você",
      "Brief IA personalizado pelo seu nicho",
      "Suporte por email",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS_RDV;

export const DEFAULT_PLAN: PlanId = "free";

export function hasIndividualCron(plan: PlanId): boolean {
  return PLANS_RDV[plan].individualCron;
}
