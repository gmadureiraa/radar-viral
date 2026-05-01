/**
 * Lista de admin emails — duplica em lib/admin.ts (server) pra check de UX.
 * Server-side é source of truth (`requireAdmin`).
 */

const DEFAULT_ADMINS = new Set([
  "gf.madureira@hotmail.com",
  "gf.madureiraa@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEFAULT_ADMINS.has(email.toLowerCase().trim());
}
