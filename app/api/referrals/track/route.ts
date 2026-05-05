/**
 * POST /api/referrals/track
 * Body: { referralCode: string }
 *
 * Chamado pelo client logo após o user fazer signup (ou no próximo SIGNED_IN
 * se tiver `rdv_ref_code` no localStorage). Cria a linha em `referrals_radar`
 * com status='signup'.
 *
 * Idempotente — chamar 2x não duplica (unique partial index em
 * referrer_user_id+referred_user_id).
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { recordReferralSignup } from "@/lib/referrals";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  let body: { referralCode?: string } = {};
  try {
    body = (await req.json()) as { referralCode?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const code = (body.referralCode || "").trim();
  if (!code) {
    return NextResponse.json(
      { error: "referralCode obrigatório" },
      { status: 400 },
    );
  }

  const result = await recordReferralSignup({
    referralCode: code,
    referredEmail: auth.user.email || "",
    referredUserId: auth.user.id,
  });

  if (!result.ok) {
    // Razões esperadas (referrer_not_found, self_referral_blocked) não são
    // erro pro cliente — apenas indicam que o código não foi associado.
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  return NextResponse.json({ ok: true });
}
