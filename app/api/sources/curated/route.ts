/**
 * /api/sources/curated — toggle ativar/desativar fontes curadas pelo user.
 *
 *  - GET: lista keys das fontes curadas DESATIVADAS pelo user (default = todas ativas)
 *  - POST: { key, disabled: true|false } — atualiza state da curated key pro user
 *
 * Tabela `disabled_curated_sources(user_id TEXT, curated_key TEXT)` — schema
 * on-demand criado no GET/POST, idempotente.
 *
 * Cron usa essa tabela pra filtrar curadas desativadas ao montar lista de
 * fontes do user (não scrapeia o que ele desligou).
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";
import { ALL_CURATED } from "@/lib/sources-curated";

export const runtime = "nodejs";

async function ensureTable(sql: ReturnType<typeof getSql>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS disabled_curated_sources (
      user_id TEXT NOT NULL,
      curated_key TEXT NOT NULL,
      disabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, curated_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS dcs_user_idx ON disabled_curated_sources (user_id)`;
}

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const sql = getSql();
  await ensureTable(sql);
  const rows = (await sql`
    SELECT curated_key
      FROM disabled_curated_sources
     WHERE user_id = ${auth.user.id}
  `) as unknown as Array<{ curated_key: string }>;
  return NextResponse.json({ disabled: rows.map((r) => r.curated_key) });
}

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  }
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  let body: { key?: string; disabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.key || typeof body.disabled !== "boolean") {
    return NextResponse.json(
      { error: "key e disabled obrigatórios" },
      { status: 400 },
    );
  }

  // Valida que key existe no catálogo (defesa contra spam)
  const exists = ALL_CURATED.some((s) => s.key === body.key);
  if (!exists) {
    return NextResponse.json({ error: "key inválida" }, { status: 400 });
  }

  const sql = getSql();
  await ensureTable(sql);

  if (body.disabled) {
    await sql`
      INSERT INTO disabled_curated_sources (user_id, curated_key)
      VALUES (${auth.user.id}, ${body.key})
      ON CONFLICT (user_id, curated_key) DO NOTHING
    `;
  } else {
    await sql`
      DELETE FROM disabled_curated_sources
       WHERE user_id = ${auth.user.id}
         AND curated_key = ${body.key}
    `;
  }

  return NextResponse.json({ ok: true, key: body.key, disabled: body.disabled });
}
