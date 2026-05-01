/**
 * GET /api/me/subscription — info da subscription do user logado.
 * Anônimo → free.
 */

import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/server-auth";
import { getUserSubscription } from "@/lib/subscriptions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await getOptionalUserId(req);
  if (!auth) {
    return NextResponse.json({
      plan: "free",
      status: "active",
      isPaid: false,
      hasStripeCustomer: false,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  }

  try {
    const sub = await getUserSubscription(auth.id);
    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      isPaid: sub.plan !== "free",
      hasStripeCustomer: Boolean(sub.stripeCustomerId),
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    });
  } catch (err) {
    console.error("[/me/subscription] failed:", err);
    return NextResponse.json(
      { plan: "free", status: "active", isPaid: false, hasStripeCustomer: false, currentPeriodEnd: null, cancelAtPeriodEnd: false },
      { status: 500 },
    );
  }
}
