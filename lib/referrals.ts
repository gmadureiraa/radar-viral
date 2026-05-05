/**
 * Sistema de referral — helpers server-side (Radar Viral).
 *
 * Mecanica:
 *   - Pro referido (quem é convidado): cupom Stripe AMIGOPRO30 (30% off 1º mês).
 *     O cupom em si vive no Stripe Dashboard como `promotion_code` e é
 *     aplicado via `allow_promotion_codes: true` no Checkout (já está
 *     habilitado em app/api/stripe/checkout/route.ts).
 *   - Pro referrer (quem indicou): 1 mês grátis de Pro em customer.balance no
 *     Stripe (= valor exato do Pro mensal) quando o referido paga primeira
 *     fatura. Abate automaticamente da próxima cobrança. Acumula sem limite.
 *
 * Datastore: Neon Postgres. Como neon_auth.user é managed, mantemos
 * código + saldo em `user_referral_codes` (PK user_id) e histórico em
 * `referrals_radar`. Evita ALTER em tabela do Better Auth.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { stripe } from "@/lib/stripe";
import {
  fireResendEvent,
  // upsertLeadInAudience,  // não usamos no fluxo de reward (já está sincronizado)
} from "@/lib/resend";
import { sendReferralConverted } from "@/lib/email-dispatch";
import { PLANS_RDV } from "@/lib/pricing";

/**
 * Recompensa = preço cheio de 1 mês do Pro. Valor importado direto de
 * PLANS_RDV.pro.priceMonthly pra ficar sempre em sync com o pricing.
 * Quando o Pro mudar de preço, o reward acompanha automaticamente.
 *
 * UI mostra "1 mês grátis de Pro" — credit em BRL é só o mecanismo Stripe.
 */
export const REFERRAL_REWARD_CENTS: number = PLANS_RDV.pro.priceMonthly;
export const REFERRAL_REWARD_LABEL = "1 mês grátis de Pro" as const;

/** Tag dos evens Resend (separa do SV/RV no mesmo painel). */
const RESEND_EVENT = "radar.referral.converted" as const;

// ────────────────────────────────────────────────────────────────────
// Helpers de geração de código
// ────────────────────────────────────────────────────────────────────

const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return out;
}

function nameSlug(name: string | null | undefined): string {
  const raw = (name || "").trim().split(/\s+/)[0] || "USER";
  // Remove acentos (NFD + strip combining) e mantém só [A-Z0-9].
  const ascii = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return (ascii || "USER").slice(0, 12);
}

export function generateReferralCode(name: string | null | undefined): string {
  return `${nameSlug(name)}-${randomSuffix()}`;
}

// ────────────────────────────────────────────────────────────────────
// SQL helpers (lazy init)
// ────────────────────────────────────────────────────────────────────

let _sql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");
  _sql = neon(url);
  return _sql;
}

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
}

async function findUserById(userId: string): Promise<UserRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, name FROM neon_auth.user WHERE id = ${userId} LIMIT 1
  `) as Array<UserRow>;
  return rows[0] ?? null;
}

// ────────────────────────────────────────────────────────────────────
// API pública
// ────────────────────────────────────────────────────────────────────

/**
 * Busca/gera o codigo do user. Garante unicidade tentando ate 5x.
 * Race-safe: usa INSERT ON CONFLICT DO NOTHING — se 2 requests rodarem
 * em paralelo, só 1 vence e o outro lê o vencedor.
 */
export async function getOrCreateReferralCode(
  userId: string,
): Promise<string | null> {
  const sql = getSql();

  // 1) Já existe?
  const existing = (await sql`
    SELECT referral_code FROM user_referral_codes WHERE user_id = ${userId} LIMIT 1
  `) as Array<{ referral_code: string }>;
  if (existing[0]?.referral_code) return existing[0].referral_code;

  // 2) Pega nome do user (pra montar slug bonitinho).
  const user = await findUserById(userId);
  if (!user) {
    console.warn("[referrals] user não encontrado em neon_auth.user:", userId);
    return null;
  }

  // 3) Tenta inserir código único (max 5 tentativas).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(user.name);

    // Checa colisão case-insensitive antes de tentar (best-effort —
    // o unique index `lower(referral_code)` é a defesa real).
    const taken = (await sql`
      SELECT 1 AS one FROM user_referral_codes
       WHERE lower(referral_code) = lower(${code}) LIMIT 1
    `) as Array<{ one: number }>;
    if (taken.length > 0) continue;

    try {
      await sql`
        INSERT INTO user_referral_codes (user_id, referral_code)
        VALUES (${userId}, ${code})
        ON CONFLICT (user_id) DO NOTHING
      `;
    } catch (err) {
      // Pode bater no unique index (lower(referral_code)) — re-tenta.
      console.warn("[referrals] insert code colidiu, retry:", err);
      continue;
    }

    // Re-lê pra cobrir o caso onde outro request setou o código antes.
    const reread = (await sql`
      SELECT referral_code FROM user_referral_codes WHERE user_id = ${userId} LIMIT 1
    `) as Array<{ referral_code: string }>;
    if (reread[0]?.referral_code) return reread[0].referral_code;
  }

  console.error("[referrals] falha gerando codigo unico apos 5 tentativas");
  return null;
}

/**
 * Resolve o userId do referrer a partir de um codigo. Case-insensitive.
 * Retorna null se nao encontrou.
 */
export async function findReferrerByCode(
  code: string,
): Promise<{ userId: string; email: string | null; name: string | null } | null> {
  if (!code || !code.trim()) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT urc.user_id, u.email, u.name
      FROM user_referral_codes urc
      LEFT JOIN neon_auth.user u ON u.id = urc.user_id
     WHERE lower(urc.referral_code) = lower(${code.trim()})
     LIMIT 1
  `) as Array<{ user_id: string; email: string | null; name: string | null }>;

  if (rows.length === 0) return null;
  return {
    userId: rows[0].user_id,
    email: rows[0].email,
    name: rows[0].name,
  };
}

/**
 * Registra signup com referral. Insere uma linha em `referrals_radar` com
 * status='signup'. Idempotente por (referrer, referred_user_id).
 *
 * Auto-referral guard: se referrer == referred, retorna sem inserir.
 */
export async function recordReferralSignup(args: {
  referralCode: string;
  referredEmail: string;
  referredUserId: string;
}): Promise<{ ok: boolean; referrerUserId?: string; reason?: string }> {
  const { referralCode, referredEmail, referredUserId } = args;
  const referrer = await findReferrerByCode(referralCode);
  if (!referrer) return { ok: false, reason: "referrer_not_found" };

  if (referrer.userId === referredUserId) {
    return { ok: false, reason: "self_referral_blocked" };
  }

  const sql = getSql();

  // Idempotência: se já existe linha pra esse par, atualiza pending → signup.
  // O unique partial index (referrer_user_id, referred_user_id) garante 1 row.
  try {
    await sql`
      INSERT INTO referrals_radar (
        referrer_user_id, referred_email, referred_user_id,
        referral_code, status, signup_at
      )
      VALUES (
        ${referrer.userId}, ${referredEmail.toLowerCase().trim()}, ${referredUserId},
        ${referralCode.trim()}, 'signup', NOW()
      )
      ON CONFLICT (referrer_user_id, referred_user_id) DO UPDATE SET
        status = CASE
          WHEN referrals_radar.status = 'pending' THEN 'signup'
          ELSE referrals_radar.status
        END,
        signup_at = COALESCE(referrals_radar.signup_at, NOW()),
        referral_code = EXCLUDED.referral_code
    `;
  } catch (err) {
    console.error("[referrals] insert/upsert signup falhou:", err);
    return { ok: false, reason: "db_error" };
  }

  return { ok: true, referrerUserId: referrer.userId };
}

/**
 * Aplica recompensa quando o referido paga. Chamado no webhook de
 * checkout.session.completed. Idempotente.
 *
 * Steps:
 *  1) Acha a linha referrals_radar pelo referredUserId (status signup ou pending).
 *  2) Busca stripe_customer_id do referrer em user_subscriptions_radar.
 *  3) Cria customer.balanceTransaction de -REFERRAL_REWARD_CENTS (= preço de
 *     1 mês de Pro). Negativo = crédito; abate na próxima fatura Stripe.
 *  4) Marca referral como converted + reward_applied=true.
 *  5) Incrementa user_referral_codes.referral_credits_cents do referrer.
 *  6) Dispara evento Resend e email transacional.
 */
export async function applyReferralReward(args: {
  referredUserId: string;
  stripeSessionId?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const { referredUserId, stripeSessionId } = args;
  const sql = getSql();

  const refRows = (await sql`
    SELECT id, referrer_user_id, reward_applied, status
      FROM referrals_radar
     WHERE referred_user_id = ${referredUserId}
       AND status IN ('pending', 'signup')
     ORDER BY created_at ASC
     LIMIT 1
  `) as Array<{
    id: string;
    referrer_user_id: string;
    reward_applied: boolean;
    status: string;
  }>;

  if (refRows.length === 0) {
    // Não tem indicação pra esse user — fluxo normal, não é erro.
    return { ok: false, reason: "no_referral" };
  }
  const referral = refRows[0];
  if (referral.reward_applied) {
    return { ok: false, reason: "already_applied" };
  }

  const referrerUserId = referral.referrer_user_id;

  // stripe_customer_id do referrer está em user_subscriptions_radar (criado
  // quando ele assinou; se ainda não assinou, registramos a indicação mas
  // sem crédito Stripe imediato — admin pode reprocessar depois).
  const subRows = (await sql`
    SELECT stripe_customer_id FROM user_subscriptions_radar
     WHERE user_id = ${referrerUserId}
     LIMIT 1
  `) as Array<{ stripe_customer_id: string | null }>;
  const stripeCustomerId = subRows[0]?.stripe_customer_id ?? null;

  // Lê email/nome do referrer pra email transacional.
  const referrer = await findUserById(referrerUserId);

  if (!stripeCustomerId) {
    console.warn(
      "[referrals] referrer sem stripe_customer_id — registrando indicação mas sem crédito imediato:",
      referrerUserId,
    );
    await sql`
      UPDATE referrals_radar
         SET status = 'converted',
             conversion_at = NOW(),
             stripe_session_id = ${stripeSessionId || null},
             reward_amount_cents = ${REFERRAL_REWARD_CENTS}
       WHERE id = ${referral.id}
    `;
    return { ok: false, reason: "referrer_no_stripe_customer" };
  }

  // Aplica crédito no Stripe customer balance.
  // Negative amount em customer balance = crédito (Stripe paga o user).
  // Doc: https://stripe.com/docs/api/customer_balance_transactions/create
  try {
    await stripe.customers.createBalanceTransaction(stripeCustomerId, {
      amount: -REFERRAL_REWARD_CENTS, // negativo = crédito
      currency: "brl",
      description: `Indique e ganhe — 1 mês grátis de Pro (referral ${referral.id})`,
      metadata: {
        referralId: referral.id,
        referrerUserId,
        referredUserId,
        source: "radar_referral_program",
      },
    });
  } catch (err) {
    console.error("[referrals] falha criando balanceTransaction Stripe:", err);
    return { ok: false, reason: "stripe_balance_tx_failed" };
  }

  // Marca como converted.
  try {
    await sql`
      UPDATE referrals_radar
         SET status = 'converted',
             conversion_at = NOW(),
             stripe_session_id = ${stripeSessionId || null},
             reward_amount_cents = ${REFERRAL_REWARD_CENTS},
             reward_applied = TRUE,
             reward_applied_at = NOW()
       WHERE id = ${referral.id}
    `;
  } catch (err) {
    console.error("[referrals] update referral falhou após crédito:", err);
    // Crédito Stripe já foi aplicado; deixa fluxo seguir mesmo assim.
  }

  // Incrementa acumulador do referrer.
  let newTotal = REFERRAL_REWARD_CENTS;
  try {
    const updated = (await sql`
      UPDATE user_referral_codes
         SET referral_credits_cents = referral_credits_cents + ${REFERRAL_REWARD_CENTS},
             updated_at = NOW()
       WHERE user_id = ${referrerUserId}
       RETURNING referral_credits_cents
    `) as Array<{ referral_credits_cents: number }>;
    if (updated[0]) newTotal = updated[0].referral_credits_cents;
  } catch (err) {
    console.warn("[referrals] update credits acumulado falhou:", err);
  }

  // Email transacional + evento Resend (fire-and-forget).
  if (referrer?.email) {
    try {
      await sendReferralConverted(
        { email: referrer.email, name: referrer.name ?? undefined },
        { rewardCents: REFERRAL_REWARD_CENTS, totalCreditCents: newTotal },
      );
    } catch (err) {
      console.warn("[referrals] sendReferralConverted falhou:", err);
    }
    await fireResendEvent(RESEND_EVENT, {
      email: referrer.email,
      user_id: referrerUserId,
      reward_cents: REFERRAL_REWARD_CENTS,
      total_credit_cents: newTotal,
      referred_user_id: referredUserId,
    });
  }

  return { ok: true };
}

/**
 * Lê stats agregados do referrer pra UI /app/settings/referrals.
 */
export async function getReferralStats(userId: string): Promise<{
  signupCount: number;
  conversionCount: number;
  totalCreditCents: number;
}> {
  const sql = getSql();

  const [countsRaw, codeRowRaw] = await Promise.all([
    sql`
      SELECT status, reward_applied, COALESCE(reward_amount_cents, 0)::int AS reward_amount_cents
        FROM referrals_radar
       WHERE referrer_user_id = ${userId}
    `,
    sql`
      SELECT referral_credits_cents FROM user_referral_codes
       WHERE user_id = ${userId} LIMIT 1
    `,
  ]);

  const list = countsRaw as Array<{
    status: string;
    reward_applied: boolean;
    reward_amount_cents: number;
  }>;
  const codeRow = codeRowRaw as Array<{ referral_credits_cents: number }>;
  const signupCount = list.filter((r) =>
    ["signup", "converted"].includes(r.status),
  ).length;
  const conversionCount = list.filter((r) => r.status === "converted").length;
  const totalCreditCents =
    codeRow[0]?.referral_credits_cents ??
    list
      .filter((r) => r.reward_applied)
      .reduce((acc, r) => acc + (r.reward_amount_cents ?? 0), 0);

  return { signupCount, conversionCount, totalCreditCents };
}

export interface ReferralListItem {
  id: string;
  referredEmail: string;
  status: "pending" | "signup" | "converted" | "expired";
  signupAt: string | null;
  conversionAt: string | null;
  rewardAmountCents: number;
  rewardApplied: boolean;
  createdAt: string;
}

export async function listReferralsForUser(
  userId: string,
  limit = 100,
): Promise<ReferralListItem[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, referred_email, status,
           signup_at::text AS signup_at,
           conversion_at::text AS conversion_at,
           reward_amount_cents, reward_applied,
           created_at::text AS created_at
      FROM referrals_radar
     WHERE referrer_user_id = ${userId}
     ORDER BY created_at DESC
     LIMIT ${limit}
  `) as Array<{
    id: string;
    referred_email: string;
    status: ReferralListItem["status"];
    signup_at: string | null;
    conversion_at: string | null;
    reward_amount_cents: number | null;
    reward_applied: boolean;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    referredEmail: r.referred_email,
    status: r.status,
    signupAt: r.signup_at,
    conversionAt: r.conversion_at,
    rewardAmountCents: r.reward_amount_cents ?? 0,
    rewardApplied: !!r.reward_applied,
    createdAt: r.created_at,
  }));
}
