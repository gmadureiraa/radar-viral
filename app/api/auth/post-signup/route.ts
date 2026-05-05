/**
 * POST /api/auth/post-signup — sincroniza lead novo no Resend.
 *
 * Chamada pelo client (auth-dialog.tsx) logo depois de:
 *   - signUp.email() bem-sucedido
 *   - signIn.social({ provider: "google" }) — primeiro login Google
 *
 * Por que existe? `RESEND_API_KEY` é server-side only. Não dá pra chamar
 * Resend direto do navegador sem expor a key. Então o client autentica
 * (Bearer JWT do Better Auth/Neon Auth) e a rota faz upsert + event
 * server-side.
 *
 * Idempotente: chamadas duplicadas (ex: Google OAuth re-callback) só
 * fazem upsert de novo, sem efeito colateral. O event sempre dispara —
 * automação no painel Resend pode dedupar via flag `idempotencyKey` do
 * próprio user_id+source se quiser.
 *
 * Falha silenciosa: erro do Resend não bloqueia retorno 200 — signup
 * já aconteceu, lead apenas não entra na sequência (logamos pra debug).
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { upsertLeadInAudience, fireResendEvent } from "@/lib/resend";

export const runtime = "nodejs";

interface PostSignupBody {
  /** "google" ou "email" — vai como tag pra automação. */
  source?: "google" | "email" | string;
  /** Override opcional pro firstName (auth-dialog passa o input do form). */
  name?: string | null;
}

export async function POST(req: Request) {
  const result = await requireUserId(req);
  if ("response" in result) return result.response;
  const { user } = result;

  if (!user.email) {
    return NextResponse.json(
      { ok: false, error: "JWT sem email — não dá pra sincronizar" },
      { status: 400 },
    );
  }

  let body: PostSignupBody = {};
  try {
    body = (await req.json()) as PostSignupBody;
  } catch {
    /* body opcional */
  }

  const source = body.source === "google" ? "google" : "email";
  const firstName =
    body.name?.trim() ||
    (typeof user.payload.name === "string" ? user.payload.name : null);

  // Roda em paralelo: ambos são fire-and-forget do ponto de vista do user.
  await Promise.allSettled([
    upsertLeadInAudience({
      email: user.email,
      firstName,
      tags: [
        { name: "source", value: source },
        { name: "plan", value: "free" },
      ],
    }),
    fireResendEvent("radar.signup", {
      email: user.email,
      first_name: firstName ?? user.email.split("@")[0],
      user_id: user.id,
      source,
      plan: "free",
    }),
  ]);

  return NextResponse.json({ ok: true });
}
