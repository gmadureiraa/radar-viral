/**
 * POST /api/stripe/portal — Stripe Customer Portal (gerenciar assinatura).
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireUserId } from "@/lib/server-auth";
import { getUserSubscription } from "@/lib/subscriptions";

export const runtime = "nodejs";

const DEFAULT_ORIGIN = "https://radar.kaleidos.com.br";
const ALLOWED_ORIGINS = [
  "https://radar.kaleidos.com.br",
  "https://radar-viral.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
];

export async function POST(req: Request) {
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;

  try {
    const sub = await getUserSubscription(userId);
    if (!sub.stripeCustomerId) {
      return NextResponse.json(
        { error: "Sem assinatura. Vá em /app/precos pra começar.", code: "no_customer" },
        { status: 400 },
      );
    }

    const reqOrigin = req.headers.get("origin");
    const origin =
      reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : DEFAULT_ORIGIN;

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/app/precos`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/portal] error:", err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Falha ao abrir portal."
            : err instanceof Error
              ? err.message
              : "Portal failed",
      },
      { status: 500 },
    );
  }
}
