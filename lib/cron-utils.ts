/**
 * Helpers compartilhados pros crons da v2.
 *
 * Auth: GET /api/cron/* exige header `x-vercel-cron` (Vercel manda automático
 * em cron schedules) OU `Authorization: Bearer ${CRON_SECRET}` OU `?token=`
 * pra rodar manualmente.
 *
 * Feature flag: `RADAR_V2_CRON_ENABLED=true` precisa estar setado pro cron
 * efetivamente rodar. Default = false (skip silencioso). Isso evita que o
 * deploy duplicate dados que a v1 ainda popula.
 *
 * Dry-run: ?dry=true retorna o que seria processado sem efeito colateral.
 *
 * Logging: insere em `cron_run_log` (tabela canônica da v1, formato:
 * user_id, niche_id, cron_type, posts_added, status, error_msg, ran_at).
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export interface CronAuthResult {
  ok: boolean;
  reason?: string;
  isDry?: boolean;
}

export function checkCronAuth(req: Request): CronAuthResult {
  const url = new URL(req.url);
  const isDry = url.searchParams.get("dry") === "true";
  const queryToken = url.searchParams.get("token");
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const userAgent = req.headers.get("user-agent") ?? "";
  const isVercelCron = req.headers.get("x-vercel-cron") !== null
    || userAgent.includes("vercel-cron");

  const cronSecret = process.env.CRON_SECRET;
  const validBearer = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const validQuery = cronSecret && queryToken === cronSecret;

  if (isVercelCron || validBearer || validQuery) {
    return { ok: true, isDry };
  }
  return { ok: false, reason: "Unauthorized", isDry };
}

export function isCronEnabled(): boolean {
  return process.env.RADAR_V2_CRON_ENABLED === "true";
}

/**
 * Logger pra `cron_run_log`. Formato canônico da v1:
 * user_id (TEXT NULL), niche_id (INT NULL), cron_type, posts_added, status, error_msg.
 *
 * Falha de log nunca derruba o cron — swallow silencioso.
 */
export async function logCronRun(
  sql: NeonQueryFunction<false, false>,
  args: {
    cronType: string;
    userId?: string | null;
    nicheId?: number | null;
    postsAdded?: number;
    status: "success" | "error" | "skipped";
    errorMsg?: string | null;
  },
): Promise<void> {
  try {
    await sql`
      INSERT INTO cron_run_log (user_id, niche_id, cron_type, posts_added, status, error_msg)
      VALUES (
        ${args.userId ?? null},
        ${args.nicheId ?? null},
        ${args.cronType},
        ${args.postsAdded ?? 0},
        ${args.status},
        ${args.errorMsg ?? null}
      )
    `;
  } catch (err) {
    console.warn("[cron] logCronRun failed (swallowed):", err);
  }
}

/** Cria sql client. Throw se DATABASE_URL ausente. */
export function getCronSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");
  return neon(url);
}

/** Wrap consistente pra responses do cron. */
export function jsonResponse(
  body: Record<string, unknown>,
  init?: { status?: number },
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}
