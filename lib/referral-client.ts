/**
 * Referral capture client-side (Radar Viral).
 *
 * Como funciona:
 *  1) Em qualquer página, se URL tem `?ref=CODE`, salvamos no localStorage
 *     com timestamp. Janela: 30 dias (depois disso, expira e ignora).
 *  2) No signup chamamos `/api/referrals/track` com Authorization Bearer
 *     pra registrar a indicação.
 *  3) Limpamos o storage só após sucesso confirmado de tracking
 *     (se /track falhar, mantemos pra retry no próximo SIGNED_IN).
 *
 * Prefixo `rdv_` pra não colidir com SV (`sv_`) ou Reels Viral (`rv_`).
 */

const STORAGE_KEY = "rdv_ref_code";
const TIMESTAMP_KEY = "rdv_ref_code_at";
const TRACKED_FLAG = "rdv_ref_code_tracked";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (!ref || !ref.trim()) return null;
    const clean = ref.trim().slice(0, 64); // sanity cap
    saveReferralCode(clean);
    return clean;
  } catch {
    return null;
  }
}

export function saveReferralCode(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
    window.localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
    // Reseta flag de tracked — code novo precisa ser trackeado de novo.
    window.localStorage.removeItem(TRACKED_FLAG);
  } catch {
    /* ignore */
  }
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = window.localStorage.getItem(STORAGE_KEY);
    if (!code) return null;
    const tsRaw = window.localStorage.getItem(TIMESTAMP_KEY);
    const ts = tsRaw ? Number(tsRaw) : 0;
    if (!ts || Date.now() - ts > MAX_AGE_MS) {
      // Expirou — limpa.
      clearReferralCode();
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearReferralCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(TIMESTAMP_KEY);
    window.localStorage.removeItem(TRACKED_FLAG);
  } catch {
    /* ignore */
  }
}

export function markReferralTracked() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRACKED_FLAG, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function wasReferralTracked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(TRACKED_FLAG);
  } catch {
    return false;
  }
}

/**
 * Tenta registrar a indicação no backend. Idempotente e silencioso em falha.
 * Chamar logo após signup confirmado (com session válida).
 */
export async function trackReferral(
  accessToken: string,
  referralCode: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/referrals/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ referralCode }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return !!data.ok;
  } catch {
    return false;
  }
}
