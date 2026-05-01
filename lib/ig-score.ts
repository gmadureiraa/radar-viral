/**
 * Viral score IG — heurística simples (mesma vibe da v1 mas enxuta).
 *
 * - log10(likes) é o sinal base
 * - Boost <48h pra freshness (decai linear até 7d)
 * - Boost 1.2× pra carrossel (gera mais saves/shares)
 * - Cap 999
 */

import type { InstagramPostRow } from "../app/api/data/instagram/posts/route";

export function igPostScore(post: InstagramPostRow): number {
  const likes = post.likes ?? 0;
  if (likes <= 0) return 0;
  const base = Math.log10(likes + 1) * 100;

  // Freshness boost
  let freshBoost = 1;
  if (post.posted_at) {
    const ageH = (Date.now() - new Date(post.posted_at).getTime()) / 3_600_000;
    if (ageH < 48) freshBoost = 1.5 - (ageH / 48) * 0.3; // 1.5 → 1.2 nas 48h
    else if (ageH < 168) freshBoost = 1.2 - ((ageH - 48) / 120) * 0.2; // 1.2 → 1.0
  }

  // Carrossel boost
  const isCarousel = (post.child_urls?.length ?? 0) > 1;
  const carouselBoost = isCarousel ? 1.2 : 1;

  return Math.min(999, Math.round(base * freshBoost * carouselBoost));
}

export function igScoreTier(score: number): { label: string; color: string } {
  if (score >= 400) return { label: "Viral", color: "#FF3D2E" };
  if (score >= 250) return { label: "Pegando", color: "#F0B33C" };
  if (score >= 100) return { label: "Forte", color: "#7CB342" };
  return { label: "Normal", color: "#888" };
}
