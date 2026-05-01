/**
 * Admin guard server-side. Espelha lib/admin-emails.ts (que é client-only).
 * Source of truth pra rotas /api/admin/*.
 */

import { requireUserId } from "./server-auth";
import { isAdminEmail } from "./admin-emails";

export async function requireAdmin(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth;

  if (!isAdminEmail(auth.user.email)) {
    return {
      response: Response.json(
        { error: "Acesso restrito — admin apenas." },
        { status: 403 },
      ),
    };
  }
  return auth;
}
