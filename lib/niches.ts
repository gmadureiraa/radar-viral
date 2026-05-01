/**
 * Niches disponíveis. Hardcoded — alinhado com a v1.
 *
 * id (slug) é usado em queries DB (`niche` column nas tabelas).
 * Cores e labels alimentam UI (badge, sidebar).
 */

export interface Niche {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: string;
}

export const NICHES: Niche[] = [
  {
    id: "crypto",
    label: "Crypto",
    emoji: "₿",
    description: "Bitcoin, Ethereum, DeFi, web3, exchanges, regulação.",
    color: "#F7931A",
  },
  {
    id: "marketing",
    label: "Marketing",
    emoji: "📈",
    description: "SEO, growth, copywriting, ads, social media, founder-led.",
    color: "#22C55E",
  },
  {
    id: "ai",
    label: "IA",
    emoji: "🤖",
    description: "LLMs, agentes, vibe coding, infra IA, automação.",
    color: "#A78BFA",
  },
];

export const DEFAULT_NICHE = NICHES[1]; // marketing como default (mesmo da v1)

export function getNiche(id: string): Niche | undefined {
  return NICHES.find((n) => n.id === id);
}
