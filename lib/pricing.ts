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
 * Custo por user Pro/mês:
 *   Apify scrape diário:
 *     ~20 IG handles × 3 posts/dia × 30d = 1800 posts × $0.005 = ~$9
 *   News RSS: zero (RSS é grátis)
 *   YouTube RSS: zero
 *   Gmail (newsletters): zero (user-side)
 *   Brief IA Gemini: ~$0.05/dia × 30 = $1.50
 *   Total: ~$10.50/mês = ~R$ 53
 *
 * Plano Pro R$ 29,90 = NEGATIVO
 * Plano Pro R$ 79 = margem 50%
 *
 * Decisão: começar mais ousado pra MVP — Pro R$ 49,90 com cap de 6 IG
 * handles + 3 YT + 6 RSS por user (não as 30 todas). Custo cai pra ~$3/mês,
 * margem 90%+. Quando user quer mais, vira upgrade.
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
