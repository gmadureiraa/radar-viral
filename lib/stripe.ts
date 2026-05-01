/**
 * Stripe SDK (Radar Viral) — server-side, lazy via Proxy.
 *
 * Mesma conta Stripe do SV/RV. Diferenciamos via `metadata.app='radar'`
 * em todo Checkout Session + Subscription. Webhook filtra por essa tag.
 */

import Stripe from "stripe";
export * from "./pricing";

let _stripeInstance: Stripe | null = null;

function buildStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "STRIPE_SECRET_KEY ausente — checkout/webhook indisponíveis. Configura no Vercel.",
      );
    }
    return new Stripe("sk_test_missing", { typescript: true });
  }
  return new Stripe(secret, { typescript: true });
}

/** Lazy proxy: instância só é construída na primeira chamada de método. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripeInstance) _stripeInstance = buildStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_stripeInstance as any)[prop];
  },
});

/** Marker que separa subs do Radar das do SV/RV no mesmo Stripe account. */
export const STRIPE_APP_TAG = "radar" as const;
