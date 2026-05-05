"use client";

/**
 * GoogleSignupSync — flush silencioso do flag `rdv:pending-google-signup`.
 *
 * Como o Google OAuth do Better Auth/Neon Auth redireciona pra fora antes
 * do client conseguir chamar /api/auth/post-signup, gravamos um marker no
 * localStorage antes do redirect. Quando o user volta autenticado, esse
 * componente (montado no root layout) detecta o marker, chama o endpoint
 * e limpa.
 *
 * Idempotente: se a sessão demorar pra hidratar, o componente fica em
 * stand-by até o token aparecer ou o user fazer logout. Marker só some
 * depois do POST 200 — falha de rede mantém o marker pra próxima carga.
 *
 * Não cobre o caso "user já tinha conta Google e está só logando":
 * nesse caso o post-signup roda mesmo assim (idempotente — upsert + event
 * `radar.signup`). É aceitável: a automação no painel Resend dedupa por
 * propriedade `user_id` se quiser bloquear re-envio.
 */

import { useEffect, useRef } from "react";
import { getJwtToken, isAuthConfigured } from "@/lib/auth-client";
import {
  getStoredReferralCode,
  trackReferral,
  markReferralTracked,
  wasReferralTracked,
} from "@/lib/referral-client";

const PENDING_GOOGLE_SIGNUP_KEY = "rdv:pending-google-signup";

export function GoogleSignupSync() {
  const fired = useRef(false);

  useEffect(() => {
    if (!isAuthConfigured()) return;
    if (fired.current) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(PENDING_GOOGLE_SIGNUP_KEY) !== "1") return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 6; // ~6s max esperando sessão hidratar
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      const token = await getJwtToken();
      if (!token) {
        if (attempts >= MAX_ATTEMPTS) return; // desiste — próxima carga retenta
        setTimeout(tick, 1000);
        return;
      }
      fired.current = true;
      try {
        const res = await fetch("/api/auth/post-signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ source: "google" }),
        });
        if (res.ok) {
          window.localStorage.removeItem(PENDING_GOOGLE_SIGNUP_KEY);
        }
        // Tenta trackear referral (se houver `rdv_ref_code` no storage e
        // ainda não foi trackeado). Idempotente: ok=true marca a flag.
        if (!wasReferralTracked()) {
          const code = getStoredReferralCode();
          if (code) {
            const ok = await trackReferral(token, code);
            if (ok) markReferralTracked();
          }
        }
      } catch {
        /* mantém flag pra próxima carga */
      }
    };
    void tick();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
