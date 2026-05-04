/**
 * /api/cron/brief — STUB (Commit A do P0-1).
 *
 * Schedule: `0 10 * * *` (diário 10:00 UTC, 1h depois do refresh). Gera
 * daily brief por (user, niche) usando Gemini Flash. Implementação
 * portada de `code/_archive/viral-hunter-v1-legacy/api/cron/brief.ts`
 * vem em commit C.
 *
 * Auth + feature flag: idem refresh.
 *
 * Idempotência: tabela `daily_briefs` tem UNIQUE (niche_id, brief_date).
 * INSERT … ON CONFLICT DO UPDATE atualiza brief do dia se rerodado.
 */

import { checkCronAuth, isCronEnabled, getCronSql, logCronRun, jsonResponse } from "@/lib/cron-utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.reason ?? "Unauthorized" }, { status: 401 });
  }

  if (!isCronEnabled()) {
    return jsonResponse({
      ok: true,
      skipped: "RADAR_V2_CRON_ENABLED não setado",
      hint: "v1 legacy ainda gera briefs. Setar env var pra ativar v2 cron.",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const t0 = Date.now();

  if (auth.isDry) {
    return jsonResponse({
      ok: true,
      dry: true,
      would_run: ["collect-signals (last 48h)", "gemini-flash brief", "upsert daily_briefs"],
      duration_ms: Date.now() - t0,
    });
  }

  await logCronRun(sql, {
    cronType: "brief",
    status: "skipped",
    errorMsg: "stub-not-implemented",
  });

  return jsonResponse({
    ok: true,
    stub: true,
    message: "Stub — implementação real em commit C.",
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
