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

  // Idempotência: SELECT primeiro pra evitar race onde o handler falha
  // mas o INSERT já marcou o evento como processado. Fluxo correto:
  //   1. Já processado? → dedup:true, sai
  //   2. Roda handler
  //   3. Sucesso → INSERT (ON CONFLICT DO NOTHING cobre concorrência)
  //   4. Falha → propaga 500 sem inserir, Stripe retenta
  try {
    const seen = (await getSql()`
      SELECT 1 AS one FROM stripe_webhook_events_radar WHERE id = ${event.id} LIMIT 1
    `) as Array<{ one: number }>;
    if (seen && seen.length > 0) {
      return NextResponse.json({ received: true, dedup: true });
    }
  } catch (err) {
    console.warn("[webhook] dedup check failed:", err);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        // created cobre a race onde Stripe dispara created antes do
        // checkout.session.completed. Mesma rota de upsert.
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        // Ignora outros eventos
        break;
    }

    // Marca como processado SÓ depois do handler ter sucesso. ON CONFLICT
    // DO NOTHING garante idempotência se duas instâncias do webhook rodarem
    // o mesmo evento em paralelo (segunda finaliza igual, no-op).
    try {
      await getSql()`
        INSERT INTO stripe_webhook_events_radar (id, type)
        VALUES (${event.id}, ${event.type})
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (err) {
      console.warn("[webhook] dedup mark failed:", err);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] handler error:", err, "event:", event.type);
    // 500 → Stripe retenta. Janela de 3 dias pra recuperar.
    // Importante: NÃO marcamos dedup row aqui, pra que o retry do Stripe
    // possa rodar o handler de novo.
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
    await enableProFeatures(userId);
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  if (sub.metadata?.app !== STRIPE_APP_TAG) return;

  const sql = getSql();

  // Fallback: subs criadas direto via Stripe (ex: Customer Portal upgrade)
  // podem chegar sem metadata.userId/planId. Recupera userId via
  // stripe_customer_id se já tivermos a row no DB.
  let userId = sub.metadata.userId;
  const planId = sub.metadata.planId as PlanId | undefined;

  if (!userId) {
    const customerId = typeof sub.customer === "string" ? sub.customer : null;
    if (customerId) {
      const rows = (await sql`
        SELECT user_id FROM user_subscriptions_radar
         WHERE stripe_customer_id = ${customerId}
         LIMIT 1
      `) as Array<{ user_id: string }>;
      if (rows.length > 0) {
        userId = rows[0].user_id;
        console.log(
          `[webhook] sub.updated fallback userId via customer=${customerId} → user=${userId}`,
        );
      }
    }
  }

  if (!userId || !planId) {
    console.warn(
      `[webhook] sub.updated bail: userId=${userId ?? "null"} planId=${planId ?? "null"} subId=${sub.id}`,
    );
    return;
  }

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
  console.log(`[webhook] sub atualizada ${sub.id} status=${sub.status} user=${userId}`);
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
    // Desliga ai_enabled — cron v1 para de gerar brief individual
    await sql`
      UPDATE user_profiles
         SET metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object('ai_enabled', 'false')
       WHERE auth_user_id = ${userId}
    `.catch((err) => console.warn("[webhook] disable ai_enabled failed:", err));
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

/**
 * Marca user_profiles.metadata.ai_enabled='true' (cron `/api/cron/brief` da v1
 * lê esse flag e gera daily_briefs personalizado por user). Garante também que
 * existe row em user_niches pra esse user (caso nunca tenha entrado em
 * configurações da v1).
 *
 * Idempotente: ON CONFLICT DO NOTHING / DO UPDATE.
 */
async function enableProFeatures(userId: string): Promise<void> {
  const sql = getSql();

  // user_profiles: cria se não existir, marca ai_enabled
  try {
    await sql`
      INSERT INTO user_profiles (auth_user_id, status, role, metadata, requested_at)
      VALUES (
        ${userId},
        'approved',
        'user',
        jsonb_build_object('ai_enabled', 'true', 'plan_source', 'radar_pro'),
        NOW()
      )
      ON CONFLICT (auth_user_id) DO UPDATE SET
        status = CASE WHEN user_profiles.status = 'pending' THEN 'approved' ELSE user_profiles.status END,
        metadata = COALESCE(user_profiles.metadata, '{}'::jsonb)
                 || jsonb_build_object('ai_enabled', 'true', 'plan_source', 'radar_pro'),
        approved_at = COALESCE(user_profiles.approved_at, NOW())
    `;
    console.log(`[webhook] user_profile.ai_enabled=true user=${userId}`);
  } catch (err) {
    console.warn("[enable-pro] user_profiles upsert failed:", err);
  }

  // user_niches: garante 1 nicho ativo (default marketing se vazio)
  try {
    const existing = (await sql`
      SELECT id FROM user_niches WHERE user_id = ${userId} AND is_active = TRUE LIMIT 1
    `) as Array<{ id: number }>;
    if (existing.length === 0) {
      await sql`
        INSERT INTO user_niches (user_id, slug, label, emoji, color, description, keywords, is_active)
        VALUES (
          ${userId}, 'marketing', 'Marketing', '📈', '#FF3D2E',
          'Growth, copywriting, social, SEO',
          ARRAY['marketing','growth','seo','social']::text[],
          TRUE
        )
        ON CONFLICT DO NOTHING
      `;
      console.log(`[webhook] user_niches default user=${userId} slug=marketing`);
    }
  } catch (err) {
    console.warn("[enable-pro] user_niches upsert failed:", err);
  }
}

