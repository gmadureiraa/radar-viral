/**
 * GET /api/referrals/me — código do user logado + stats agregados.
 *
 * Resposta:
 *   { code: string, signupCount: number, conversionCount: number,
 *     totalCreditCents: number }
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getOrCreateReferralCode, getReferralStats } from "@/lib/referrals";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;

  const code = await getOrCreateReferralCode(userId);
  if (!code) {
    return NextResponse.json(
      { error: "Falha ao gerar código de indicação" },
      { status: 500 },
    );
  }

  const stats = await getReferralStats(userId);

  return NextResponse.json({
    code,
    signupCount: stats.signupCount,
    conversionCount: stats.conversionCount,
    totalCreditCents: stats.totalCreditCents,
  });
}
