/**
 * Subscriptions Radar — server-side. Usa tabela `user_subscriptions_radar`
 * (separada da do RV/SV pra evitar colisão de PK quando user pagar 2 apps).
 */

import { neon } from "@neondatabase/serverless";
import { DEFAULT_PLAN, hasIndividualCron, type PlanId } from "./pricing";

const dbUrl = process.env.DATABASE_URL;

function getSql() {
  if (!dbUrl) throw new Error("DATABASE_URL missing");
  return neon(dbUrl);
}

export interface UserSubscription {
  userId: string;
  plan: PlanId;
  status: "active" | "past_due" | "canceled" | "incomplete" | "banned";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface SubRow {
  user_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const sql = getSql();
  const rows = (await sql`
    SELECT user_id, plan, status, stripe_customer_id, stripe_subscription_id,
           current_period_start::text, current_period_end::text, cancel_at_period_end
      FROM user_subscriptions_radar
     WHERE user_id = ${userId}
     LIMIT 1
  `) as unknown as SubRow[];

  if (rows.length === 0) {
    return {
      userId,
      plan: DEFAULT_PLAN,
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  const row = rows[0];
  const isActive = row.status === "active";
  return {
    userId: row.user_id,
    plan: isActive ? (row.plan as PlanId) : DEFAULT_PLAN,
    status: row.status as UserSubscription["status"],
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

export async function userHasIndividualCron(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  return hasIndividualCron(sub.plan) && sub.status === "active";
}
