/**
 * Helpers de conversion events Meta Pixel.
 *
 * Pixel base é montado em `app/layout.tsx` via `<MetaPixel pixelId={...} />`
 * (componente em `components/MetaPixel.tsx`). Aqui só os disparos de
 * eventos pra otimização Meta Ads — Lead, CompleteRegistration, Subscribe.
 *
 * Todos guard `typeof window !== "undefined"` + `window.fbq` pra:
 * 1. Não quebrar SSR
 * 2. Não disparar antes do script carregar
 * 3. Não dar erro se user tem ad blocker bloqueando o pixel
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackLead(contentName = "signup"): void {
  if (typeof window === "undefined" || !window.fbq) return;
  try {
    window.fbq("track", "Lead", { content_name: contentName });
  } catch {
    /* ad blocker ou pixel quebrado */
  }
}

export function trackCompleteRegistration(status = "verified"): void {
  if (typeof window === "undefined" || !window.fbq) return;
  try {
    window.fbq("track", "CompleteRegistration", { status });
  } catch {
    /* idem */
  }
}

export function trackSubscribe(value: number, plan: string): void {
  if (typeof window === "undefined" || !window.fbq) return;
  try {
    window.fbq("track", "Subscribe", {
      value,
      currency: "BRL",
      predicted_ltv: value * 12,
      content_name: `radar_${plan}`,
    });
  } catch {
    /* idem */
  }
}

export {};
