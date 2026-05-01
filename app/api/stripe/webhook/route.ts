/**
 * POST /api/stripe/webhook — eventos Stripe.
 *
 * Filtra metadata.app='radar' (eventos do SV/RV são silenciosamente
 * ignorados). Idempotente via stripe_webhook_events_radar.
 *
 * Eventos:
 *  - checkout.session.completed → cria/upserta user_subscriptions_radar
 *    + popula tracked_sources com fontes do nicho ativo do user
 *  - customer.subscription.updated → sincroniza estado
 *  - customer.subscription.deleted → status='canceled', plano vira free
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_APP_TAG, type PlanId } from "@/lib/stripe";
import { neon } from "@neondatabase/serverless";
import { getCuratedSources } from "@/lib/sources-curated";
import { PLANS_RDV } from "@/lib/pricing";

export const runtime = "nodejs";

const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET_RADAR ?? process.env.STRIPE_WEBHOOK_SECRET;

const dbUrl = process.env.DATABASE_URL;

function getSql() {
  if (!dbUrl) throw new Error("DATABASE_URL missing");
  return neon(dbUrl);
}

export async function POST(req: Request) {
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET_RADAR ausente");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotência
  try {
    const inserted = (await getSql()`
      INSERT INTO stripe_webhook_events_radar (id, type)
      VALUES (${event.id}, ${event.type})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;
    if (!inserted || inserted.length === 0) {
      return NextResponse.json({ received: true, dedup: true });
    }
  } catch (err) {
    console.warn("[webhook] dedup miss:", err);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        // Ignora outros eventos
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] handler error:", err, "event:", event.type);
    // 500 → Stripe retenta. Janela de 3 dias pra recuperar.
    return NextResponse.json(
      { error: "handler failed", eventId: event.id },
      { status: 500 },
    );
  }
}

// ───────────────────────────────────────────────────────────────────────
// Handlers
// ───────────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.app !== STRIPE_APP_TAG) return;

  const userId = session.metadata.userId;
  const planId = session.metadata.planId as PlanId | undefined;
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  if (!userId || !planId || !customerId || !subscriptionId) {
    console.warn("[webhook] checkout.completed missing fields:", session.id);
    return;
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  const sql = getSql();
  await sql`
    INSERT INTO user_subscriptions_radar (
      user_id, plan, status,
      stripe_customer_id, stripe_subscription_id, stripe_price_id,
      current_period_start, current_period_end, cancel_at_period_end,
      created_at, updated_at
    )
    VALUES (
      ${userId}, ${planId}, ${sub.status},
      ${customerId}, ${subscriptionId},
      ${sub.items.data[0]?.price?.id ?? null},
      to_timestamp(${(sub as unknown as { current_period_start: number }).current_period_start}),
      to_timestamp(${(sub as unknown as { current_period_end: number }).current_period_end}),
      ${sub.cancel_at_period_end},
      NOW(), NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_price_id = EXCLUDED.stripe_price_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = NOW()
  `;

  console.log(`[webhook] sub criada/atualizada user=${userId} plan=${planId}`);

  // Ativa cron individual: copia fontes_curated do nicho do user pra
  // tracked_sources com user_id. Cron `/api/cron/refresh` da v1 lê
  // tracked_sources e popula DB.
  if (planId === "pro") {
    await activateUserSources(userId);
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  if (sub.metadata?.app !== STRIPE_APP_TAG) return;
  const userId = sub.metadata.userId;
  const planId = sub.metadata.planId as PlanId | undefined;
  if (!userId || !planId) return;

  const sql = getSql();
  await sql`
    UPDATE user_subscriptions_radar
       SET plan = ${planId},
           status = ${sub.status},
           stripe_price_id = ${sub.items.data[0]?.price?.id ?? null},
           current_period_start = to_timestamp(${(sub as unknown as { current_period_start: number }).current_period_start}),
           current_period_end = to_timestamp(${(sub as unknown as { current_period_end: number }).current_period_end}),
           cancel_at_period_end = ${sub.cancel_at_period_end},
           updated_at = NOW()
     WHERE stripe_subscription_id = ${sub.id}
  `;
  console.log(`[webhook] sub atualizada ${sub.id} status=${sub.status}`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  if (sub.metadata?.app !== STRIPE_APP_TAG) return;
  const sql = getSql();
  await sql`
    UPDATE user_subscriptions_radar
       SET plan = 'free', status = 'canceled', updated_at = NOW()
     WHERE stripe_subscription_id = ${sub.id}
  `;
  // Desativa fontes individuais (deixa o user voltando pro radar global)
  const userId = sub.metadata?.userId;
  if (userId) {
    await sql`
      UPDATE tracked_sources
         SET active = FALSE
       WHERE user_id = ${userId}
    `;
  }
  console.log(`[webhook] sub cancelada ${sub.id} → user volta pra free`);
}

/**
 * Lê o nicho default do user (fallback marketing) e popula tracked_sources
 * com fontes_curated do nicho. Respeita caps definidos em PLANS_RDV.pro.
 *
 * Idempotente — usa ON CONFLICT pra não duplicar handles já trackados.
 */
async function activateUserSources(userId: string): Promise<void> {
  const sql = getSql();

  // Busca niche preferido do user (se já tiver row em user_niches v1).
  // Fallback: marketing (default da v2).
  let nicheSlug = "marketing";
  try {
    const rows = (await sql`
      SELECT slug FROM user_niches WHERE user_id = ${userId} LIMIT 1
    `) as Array<{ slug: string }>;
    if (rows.length > 0) nicheSlug = rows[0].slug;
  } catch {
    /* user_niches pode não existir em outras instalações */
  }

  const sources = getCuratedSources(nicheSlug);
  if (!sources) {
    console.warn(`[webhook] sem fontes curadas pro nicho ${nicheSlug}`);
    return;
  }

  const caps = PLANS_RDV.pro;
  const igHandles = sources.igHandles.slice(0, caps.igHandlesCap);
  const ytChannels = sources.youtubeChannels.slice(0, caps.ytChannelsCap);

  // IG handles
  for (const h of igHandles) {
    await sql`
      INSERT INTO tracked_sources (platform, niche, handle, display_name, active, source, user_id, added_at)
      VALUES ('instagram', ${nicheSlug}, ${h.handle}, ${h.label}, TRUE, 'curated', ${userId}, NOW())
      ON CONFLICT DO NOTHING
    `.catch((err) => console.warn("[activate-sources] ig insert failed:", err));
  }

  // YT channels
  for (const c of ytChannels) {
    await sql`
      INSERT INTO tracked_sources (platform, niche, handle, display_name, active, source, user_id, added_at)
      VALUES ('youtube', ${nicheSlug}, ${c.handle}, ${c.label}, TRUE, 'curated', ${userId}, NOW())
      ON CONFLICT DO NOTHING
    `.catch((err) => console.warn("[activate-sources] yt insert failed:", err));
  }

  console.log(
    `[webhook] activated sources user=${userId} niche=${nicheSlug} ig=${igHandles.length} yt=${ytChannels.length}`,
  );
}

