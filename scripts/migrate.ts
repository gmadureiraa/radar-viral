/**
 * Migration runner — Radar Viral v2.
 *
 * Cria tabelas próprias da v2 sem mexer nas tabelas v1 (que continuam
 * populando o DB compartilhado).
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS.
 *
 * Rodar: `bun scripts/migrate.ts`
 */

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente — cheque .env.local");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  console.log("[migrate] starting Radar v2 migrations…");

  // ────────────────────────────────────────────────────────────────────
  // user_subscriptions_radar (paywall)
  // ────────────────────────────────────────────────────────────────────
  // Separada da `user_subscriptions` (que é do RV) pra user poder ter
  // assinatura ativa em Radar + RV simultaneamente.
  await sql.query(`
    CREATE TABLE IF NOT EXISTS user_subscriptions_radar (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT UNIQUE,
      stripe_price_id TEXT,
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate] ✓ user_subscriptions_radar");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS user_subs_radar_stripe_customer_idx
    ON user_subscriptions_radar (stripe_customer_id)
  `);
  console.log("[migrate] ✓ user_subs_radar_stripe_customer_idx");

  // ────────────────────────────────────────────────────────────────────
  // stripe_webhook_events_radar (idempotência)
  // ────────────────────────────────────────────────────────────────────
  // Stripe pode retransmitir eventos. Antes de processar, INSERT … ON
  // CONFLICT garante que cada event.id só roda uma vez.
  await sql.query(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events_radar (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[migrate] ✓ stripe_webhook_events_radar");

  // ────────────────────────────────────────────────────────────────────
  // tracked_sources — JÁ existe (criada pela v1). Garante que tem coluna
  // user_id pra suportar tracked_sources individuais. v1 popula handles
  // globais sem user_id; v2 vai popular per-user quando user assinar.
  // ────────────────────────────────────────────────────────────────────
  // Não criamos a tabela aqui — ela é canônica da v1. Só verificamos.
  const cols = (await sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'tracked_sources'
  `) as Array<{ column_name: string }>;
  const hasUserId = cols.some((c) => c.column_name === "user_id");
  if (!hasUserId) {
    await sql.query(`ALTER TABLE tracked_sources ADD COLUMN IF NOT EXISTS user_id TEXT`);
    await sql.query(
      `CREATE INDEX IF NOT EXISTS tracked_sources_user_idx ON tracked_sources (user_id)`,
    );
    console.log("[migrate] ✓ tracked_sources.user_id (added)");
  } else {
    console.log("[migrate] · tracked_sources.user_id já existe");
  }

  // ────────────────────────────────────────────────────────────────────
  // user_profiles — colunas de tracking pra crons de lifecycle Resend
  // ────────────────────────────────────────────────────────────────────
  // Idempotente. Cada cron de email (weekly/idle/power) marca timestamp
  // pra evitar duplicar disparo. user_profiles é canônica da v1; só
  // adicionamos colunas auxiliares.
  await sql.query(`
    ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS last_idle_5d_email_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_power_user_email_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_weekly_digest_at TIMESTAMPTZ
  `);
  console.log("[migrate] ✓ user_profiles.last_*_email_at / last_weekly_digest_at");

  // ────────────────────────────────────────────────────────────────────
  // tiktok_posts (cron scrape-tiktok)
  // ────────────────────────────────────────────────────────────────────
  // Tabela criada pela v2. Idempotente: cron `/api/cron/scrape-tiktok`
  // também roda CREATE TABLE IF NOT EXISTS no startup, mas rodar aqui
  // garante schema antes do primeiro deploy do cron.
  await sql.query(`
    CREATE TABLE IF NOT EXISTS tiktok_posts (
      post_id TEXT PRIMARY KEY,
      account_handle TEXT NOT NULL,
      niche TEXT,
      niche_id INTEGER,
      user_id TEXT,
      caption TEXT,
      video_url TEXT,
      cover_url TEXT,
      music_name TEXT,
      plays BIGINT NOT NULL DEFAULT 0,
      likes BIGINT NOT NULL DEFAULT 0,
      shares BIGINT NOT NULL DEFAULT 0,
      comments BIGINT NOT NULL DEFAULT 0,
      hashtags JSONB,
      posted_at TIMESTAMPTZ,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB
    )
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS tiktok_posts_user_idx ON tiktok_posts (user_id)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS tiktok_posts_niche_idx ON tiktok_posts (niche)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS tiktok_posts_posted_idx ON tiktok_posts (posted_at DESC)`);
  console.log("[migrate] ✓ tiktok_posts");

  // ────────────────────────────────────────────────────────────────────
  // user_referral_codes — código único por user + saldo acumulado
  // ────────────────────────────────────────────────────────────────────
  // Não dá pra ALTER neon_auth.user (tabela managed). Mantemos código +
  // acumulador em tabela própria. user_id casa com neon_auth.user.id.
  await sql.query(`
    CREATE TABLE IF NOT EXISTS user_referral_codes (
      user_id TEXT PRIMARY KEY,
      referral_code TEXT NOT NULL,
      referral_credits_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_referral_codes_code_unique
      ON user_referral_codes (lower(referral_code))
  `);
  console.log("[migrate] ✓ user_referral_codes");

  // ────────────────────────────────────────────────────────────────────
  // referrals_radar — histórico de cada indicação
  // ────────────────────────────────────────────────────────────────────
  // referrer (quem indicou) → referred (quem foi indicado).
  // Status: pending → signup → converted (quando paga primeira fatura).
  // reward_applied=true marca crédito Stripe customer.balance já aplicado.
  await sql.query(`
    CREATE TABLE IF NOT EXISTS referrals_radar (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      referrer_user_id TEXT NOT NULL,
      referred_email TEXT NOT NULL,
      referred_user_id TEXT,
      referral_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'signup', 'converted', 'expired')),
      signup_at TIMESTAMPTZ,
      conversion_at TIMESTAMPTZ,
      stripe_session_id TEXT,
      reward_amount_cents INTEGER NOT NULL DEFAULT 0,
      reward_applied BOOLEAN NOT NULL DEFAULT FALSE,
      reward_applied_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS referrals_radar_referrer_idx ON referrals_radar (referrer_user_id)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS referrals_radar_code_idx ON referrals_radar (referral_code)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS referrals_radar_status_idx ON referrals_radar (status)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS referrals_radar_referred_user_idx ON referrals_radar (referred_user_id)`);
  // Idempotência: 1 par (referrer, referred_user) único — UPSERT-friendly
  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS referrals_radar_pair_unique
      ON referrals_radar (referrer_user_id, referred_user_id)
      WHERE referred_user_id IS NOT NULL
  `);
  console.log("[migrate] ✓ referrals_radar");

  // ────────────────────────────────────────────────────────────────────
  // Sanity
  // ────────────────────────────────────────────────────────────────────
  const tables = await sql.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND (table_name LIKE '%radar%' OR table_name LIKE '%referral%')
     ORDER BY table_name
  `);
  console.log("\n[migrate] tabelas v2:");
  for (const r of tables as Array<{ table_name: string }>) {
    console.log("  •", r.table_name);
  }
}

main()
  .then(() => {
    console.log("\n[migrate] done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[migrate] failed:", err);
    process.exit(1);
  });
