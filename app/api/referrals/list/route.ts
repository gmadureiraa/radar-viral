/**
 * GET /api/referrals/list — histórico de indicações do user logado.
 *
 * Email do referido vem mascarado pra proteger privacidade
 * (a@b.com → a***@b.com).
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { listReferralsForUser } from "@/lib/referrals";

export const runtime = "nodejs";

function maskEmail(email: string): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] || ""}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function GET(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  let rows;
  try {
    rows = await listReferralsForUser(auth.user.id);
  } catch (err) {
    console.error("[referrals/list] erro:", err);
    return NextResponse.json(
      { error: "Falha ao buscar indicações" },
      { status: 500 },
    );
  }

  const items = rows.map((r) => ({
    id: r.id,
    email: maskEmail(r.referredEmail || ""),
    status: r.status,
    signupAt: r.signupAt,
    conversionAt: r.conversionAt,
    rewardAmountCents: r.rewardAmountCents,
    rewardApplied: r.rewardApplied,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ items });
}
