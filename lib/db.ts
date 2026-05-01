/**
 * Neon Postgres helper — single instance lazy.
 *
 * Lê DATABASE_URL e devolve o `sql` tag pra queries. Reusado em routes
 * server-side (não exportar pro client — secret).
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");
  _sql = neon(url);
  return _sql;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
