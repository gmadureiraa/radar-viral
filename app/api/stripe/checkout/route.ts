/**
 * POST /api/stripe/checkout — cria sessão Stripe Checkout.
 *
 * Body: { planId: 'pro' }
 *
 * Reusa conta Stripe do SV/RV. Diferenciador: metadata.app='radar' tanto
 * na session quanto na subscription. Webhook filtra por essa tag.
 *
 * Pricing inline via product_data — Gabriel não precisa criar product
 * manualmente no dashboard. Quando quiser, seta STRIPE_PRICE_RDV_PRO_MONTH
 * em env e passamos a usar Price IDs.
 */

import { NextResponse } from "next/server";
import { stripe, PLANS_RDV, STRIPE_APP_TAG, type PlanId } from "@/lib/stripe";
import { requireUserId } from "@/lib/server-auth";
import { neon } from "@neondatabase/serverless";

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
  const userEmail = auth.user.email;

  let body: { planId?: string };
  try {
    body = (await req.json()) as { planId?: string };
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const planId = body.planId as PlanId | undefined;
  if (!planId || planId === "free" || !PLANS_RDV[planId]) {
    return NextResponse.json({ error: "planId deve ser 'pro'" }, { status: 400 });
  }
  const plan = PLANS_RDV[planId];

  // Reuse stripe_customer_id se já existe (consistência cross-checkouts).
  const dbUrl = process.env.DATABASE_URL;
  let existingCustomerId: string | null = null;
  if (dbUrl) {
    try {
      const sql = neon(dbUrl);
      const rows = (await sql`
        SELECT stripe_customer_id FROM user_subscriptions_radar
         WHERE user_id = ${userId} LIMIT 1
      `) as Array<{ stripe_customer_id: string | null }>;
      existingCustomerId = rows[0]?.stripe_customer_id ?? null;
    } catch (err) {
      console.warn("[checkout] read existing customer failed:", err);
    }
  }

  const reqOrigin = req.headers.get("origin");
  const origin =
    reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : DEFAULT_ORIGIN;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: userEmail || undefined }),
      client_reference_id: userId,
      metadata: {
        app: STRIPE_APP_TAG,
        userId,
        planId,
      },
      subscription_data: {
        metadata: {
          app: STRIPE_APP_TAG,
          userId,
          planId,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Radar Viral ${plan.name}`,
              description: plan.features.slice(0, 4).join(" · "),
            },
            unit_amount: plan.priceMonthly,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${origin}/app/precos?payment=success&plan=${planId}`,
      cancel_url: `${origin}/app/precos?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] stripe error:", err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Falha ao criar checkout. Tente novamente."
            : err instanceof Error
              ? err.message
              : "Checkout failed",
      },
      { status: 500 },
    );
  }
}
