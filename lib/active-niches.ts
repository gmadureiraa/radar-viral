/**
 * Active niches helper — usado pelos crons pra economizar custo Apify.
 *
 * Regra (decidida 2026-05-08):
 *  - `marketing` e `ai` SEMPRE rodam diariamente (nichos defaults com tráfego).
 *  - `crypto` só roda se houver pelo menos 1 user com fontes do nicho
 *    cadastradas (`tracked_sources.niche='crypto' AND user_id IS NOT NULL`).
 *
 * Permite escalar pra outros nichos no futuro sem refator: se nicho novo
 * surgir e ninguém usar, cron skipa. Quando user com aquele nicho adicionar
 * fonte, próximo cron passa a incluir.
 */

import type { NeonQueryFunction } from "@neondatabase/serverless";

const DEFAULT_NICHES = ["marketing", "ai"] as const;

export async function getActiveNiches(
  sql: NeonQueryFunction<false, false>,
): Promise<Set<string>> {
  const set = new Set<string>(DEFAULT_NICHES);
  try {
    const rows = (await sql`
      SELECT DISTINCT niche::text AS niche
        FROM tracked_sources
       WHERE user_id IS NOT NULL
         AND COALESCE(active, TRUE) = TRUE
    `) as Array<{ niche: string }>;
    for (const r of rows) {
      if (r.niche) set.add(r.niche);
    }
  } catch (err) {
    console.warn("[active-niches] query fallback (default only):", err);
  }
  return set;
}
