/**
 * /api/cron/refresh — STUB (Commit A do P0-1).
 *
 * Schedule: `0 9 * * *` (diário 09:00 UTC). Implementação portada do
 * v1 legacy `code/_archive/viral-hunter-v1-legacy/api/cron/refresh.ts`
 * vem em commit separado (B).
 *
 * Auth: header `x-vercel-cron` OU `Authorization: Bearer $CRON_SECRET`
 * OU `?token=$CRON_SECRET`.
 *
 * Feature flag: `RADAR_V2_CRON_ENABLED=true` exigido. Sem flag → skip
 * silencioso. Evita que v2 duplique dados que v1 ainda popula no mesmo
 * Neon DB.
 *
 * Dry-run: `?dry=true` retorna o que seria processado sem rodar nada.
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
      hint: "v1 legacy ainda popula DB. Setar env var pra ativar v2 cron.",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const t0 = Date.now();

  if (auth.isDry) {
    return jsonResponse({
      ok: true,
      dry: true,
      would_run: ["refresh-news (RSS)", "refresh-ig (Apify)", "refresh-youtube (RSS)"],
      duration_ms: Date.now() - t0,
    });
  }

  // Implementação real vem no commit B. Por enquanto loga skip.
  await logCronRun(sql, {
    cronType: "refresh",
    status: "skipped",
    errorMsg: "stub-not-implemented",
  });

  return jsonResponse({
    ok: true,
    stub: true,
    message: "Stub — implementação real em commit B.",
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
