"use client";

/**
 * /app/precos — Free + Pro side by side. Plano atual destacado.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Settings } from "lucide-react";
import { toast } from "sonner";
import { PLANS_RDV, type PlanId } from "@/lib/pricing";
import { useNeonSession, getJwtToken } from "@/lib/auth-client";
import { trackSubscribe } from "@/lib/meta-pixel";
import { getStoredReferralCode } from "@/lib/referral-client";

interface SubscriptionInfo {
  plan: PlanId;
  status: string;
  isPaid: boolean;
  hasStripeCustomer: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingInner />
    </Suspense>
  );
}

function PricingInner() {
  const session = useNeonSession();
  const router = useRouter();
  const params = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<"pro" | "max" | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);

  // Toast pós-checkout (Stripe redirect com ?payment=success|cancelled)
  useEffect(() => {
    const payment = params.get("payment");
    if (payment === "success") {
      // Conversion event Meta — Subscribe. Lê plan do search param (success_url
      // do checkout grava ?plan=pro|max). Valor monetário em BRL inteiro.
      const planParam = params.get("plan");
      if (planParam === "pro" || planParam === "max") {
        const cents = PLANS_RDV[planParam].priceMonthly;
        trackSubscribe(cents / 100, planParam);
      }
      toast.success("Pagamento confirmado! Pode levar alguns segundos pro plano aparecer.");
      // Limpa params pra não duplicar evento em refresh.
      router.replace("/app/precos");
    } else if (payment === "cancelled") {
      toast.info("Checkout cancelado");
      router.replace("/app/precos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (!session.data?.user) return;
    let cancel = false;
    (async () => {
      try {
        const jwt = await getJwtToken();
        const res = await fetch("/api/me/subscription", {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
        });
        if (!res.ok) return;
        const data = (await res.json()) as SubscriptionInfo;
        if (!cancel) setSubInfo(data);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [session.data?.user?.id]);

  async function handleSubscribe(planId: "pro" | "max") {
    setLoadingPlan(planId);
    try {
      const jwt = await getJwtToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
      // Defense-in-depth: signup já registra a referral em referrals_radar
      // (via /api/referrals/track), mas se aquele tracking falhou silencioso,
      // re-enviar o código no checkout garante que metadata.referralCode
      // chegue na session e o webhook ainda consiga creditar o referrer.
      const referralCode = getStoredReferralCode();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({ planId, ...(referralCode ? { referralCode } : {}) }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Falha ao criar checkout");
      window.location.href = data.url as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
      setLoadingPlan(null);
    }
  }

  async function handleOpenPortal() {
    setLoadingPortal(true);
    try {
      const jwt = await getJwtToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
      const res = await fetch("/api/stripe/portal", { method: "POST", headers });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Falha ao abrir portal");
      window.location.href = data.url as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
      setLoadingPortal(false);
    }
  }

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6, justifyContent: "center" }}>
        <span className="rdv-rec-dot" /> PLANOS · ASSINATURA MENSAL
      </div>
      <h1
        className="rdv-display"
        style={{
          fontSize: "clamp(34px, 4.5vw, 56px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        A maioria cria conteúdo <em>às cegas</em>.
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "var(--color-rdv-muted)",
          textAlign: "center",
          maxWidth: 640,
          margin: "0 auto 40px",
          lineHeight: 1.55,
        }}
      >
        O Radar Viral analisa seu nicho e te entrega os ganchos, formatos e
        temas que estão viralizando agora mesmo. Comece de graça com o radar
        global compartilhado, ou assine o Pro pra ter o seu radar individual
        com cron próprio, TikTok scraping, briefs ilimitados e agente IA
        conversacional por nicho.
      </p>

      <div
        id="planos"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        {/* User com plan='max' grandfathered ainda enxerga o card Max pra poder
            gerenciar/cancelar. Pra todo mundo, mostra só Free + Pro. */}
        {(
          ["free", "pro", "max"] as PlanId[]
        ).filter((planId) => {
          if (PLANS_RDV[planId].hidden) {
            // Max só aparece se for o plano atual do user (legacy).
            return subInfo?.plan === planId;
          }
          return true;
        }).map((planId) => {
          const isCurrent = subInfo?.plan === planId;
          const isFree = planId === "free";
          const isLoading = loadingPlan === planId;

          let ctaLabel = isFree
            ? "Plano atual"
            : `Assinar ${PLANS_RDV[planId].name}`;
          let onClick: () => void = () => {
            if (planId === "pro" || planId === "max") {
              void handleSubscribe(planId);
            }
          };
          let disabled = isFree;
          let loading = isLoading;

          if (isCurrent && !isFree && subInfo?.hasStripeCustomer) {
            ctaLabel = loadingPortal ? "Aguarde..." : "Gerenciar";
            onClick = () => void handleOpenPortal();
            disabled = false;
            loading = loadingPortal;
          } else if (isCurrent && isFree) {
            ctaLabel = "Plano atual";
            disabled = true;
          }

          // Pro é o tier pago padrão — recebe destaque visual a menos que
          // user já esteja nele.
          const highlighted = planId === "pro" && !isCurrent;

          return (
            <PlanCard
              key={planId}
              planId={planId}
              highlighted={highlighted}
              isCurrent={isCurrent}
              ctaLabel={ctaLabel}
              loading={loading}
              disabled={disabled}
              onSubscribe={onClick}
              cancelAtPeriodEnd={isCurrent ? Boolean(subInfo?.cancelAtPeriodEnd) : false}
              periodEnd={isCurrent ? subInfo?.currentPeriodEnd ?? null : null}
            />
          );
        })}
      </div>

      <p
        style={{
          textAlign: "center",
          marginTop: 36,
          fontSize: 12,
          color: "var(--color-rdv-muted)",
        }}
      >
        Cobrança recorrente mensal · Cancele quando quiser · Stripe BR · Pagamento por cartão
      </p>
    </main>
  );
}

// ─── PlanCard ──────────────────────────────────────────────────────────

function PlanCard({
  planId,
  highlighted,
  isCurrent,
  ctaLabel,
  loading,
  disabled,
  onSubscribe,
  cancelAtPeriodEnd,
  periodEnd,
}: {
  planId: PlanId;
  highlighted: boolean;
  isCurrent?: boolean;
  ctaLabel: string;
  loading?: boolean;
  disabled?: boolean;
  onSubscribe: () => void;
  cancelAtPeriodEnd?: boolean;
  periodEnd?: string | null;
}) {
  const plan = PLANS_RDV[planId];
  const priceFormatted =
    plan.priceMonthly === 0
      ? "Grátis"
      : `R$ ${(plan.priceMonthly / 100).toFixed(2).replace(".", ",")}`;
  const anchor =
    "priceAnchor" in plan && plan.priceAnchor
      ? `R$ ${(plan.priceAnchor / 100).toFixed(2).replace(".", ",")}`
      : null;
  const periodEndDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  return (
    <div
      style={{
        background: "var(--color-rdv-cream)",
        border: `1.5px solid ${
          isCurrent
            ? "var(--color-rdv-ink)"
            : highlighted
              ? "var(--color-rdv-rec)"
              : "var(--color-rdv-ink)"
        }`,
        boxShadow: isCurrent
          ? "10px 10px 0 0 var(--color-rdv-amber)"
          : highlighted
            ? "10px 10px 0 0 var(--color-rdv-rec)"
            : "5px 5px 0 0 var(--color-rdv-ink)",
        padding: "28px 26px 26px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {isCurrent && (
        <div
          className="rdv-mono"
          style={{
            position: "absolute",
            top: -12,
            left: 16,
            background: "var(--color-rdv-amber)",
            color: "var(--color-rdv-ink)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "5px 10px",
          }}
        >
          ✓ Plano atual
        </div>
      )}
      {highlighted && !isCurrent && (
        <div
          className="rdv-mono"
          style={{
            position: "absolute",
            top: -12,
            right: 16,
            background: "var(--color-rdv-rec)",
            color: "white",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "5px 10px",
          }}
        >
          Recomendado
        </div>
      )}

      <div className="rdv-eyebrow" style={{ marginBottom: 8, marginTop: isCurrent ? 6 : 0 }}>
        {plan.name.toUpperCase()}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span
          className="rdv-display"
          style={{ fontSize: 38, lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          {priceFormatted}
        </span>
        {plan.priceMonthly > 0 && (
          <span style={{ fontSize: 13, color: "var(--color-rdv-muted)" }}>/mês</span>
        )}
      </div>
      {anchor && (
        <div style={{ fontSize: 12, color: "var(--color-rdv-muted)", marginBottom: 18 }}>
          de <s>{anchor}</s>
        </div>
      )}
      {!anchor && <div style={{ height: 18 }} />}

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "12px 0 22px",
          display: "grid",
          gap: 10,
          flex: 1,
        }}
      >
        {plan.features.map((feat, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.4 }}>
            <Check
              size={14}
              style={{
                flexShrink: 0,
                marginTop: 2,
                color: highlighted ? "var(--color-rdv-rec)" : "var(--color-rdv-ink)",
              }}
              strokeWidth={2.5}
            />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSubscribe}
        disabled={disabled || loading}
        className={
          isCurrent ? "rdv-btn rdv-btn-ghost" : highlighted ? "rdv-btn rdv-btn-rec" : "rdv-btn rdv-btn-ghost"
        }
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: 12,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {loading && <Loader2 size={12} className="rdv-spin" />}
        {isCurrent && !disabled && <Settings size={12} />}
        {!isCurrent && !disabled && !loading && planId !== "free" && <Sparkles size={12} />}
        {ctaLabel}
      </button>

      {isCurrent && periodEndDate && (
        <p
          className="rdv-mono"
          style={{
            marginTop: 10,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: cancelAtPeriodEnd ? "var(--color-rdv-rec)" : "var(--color-rdv-muted)",
            textAlign: "center",
          }}
        >
          {cancelAtPeriodEnd ? `⚠ Cancela em ${periodEndDate}` : `Renova em ${periodEndDate}`}
        </p>
      )}
    </div>
  );
}
