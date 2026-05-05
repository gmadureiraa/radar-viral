"use client";

/**
 * /app/settings/referrals — UI do programa "Indique e ganhe" do Radar Viral.
 *
 * Mecânica:
 *   - Cada user tem 1 link único: https://radar.kaleidos.com.br/?ref=<code>
 *   - Quem entra com o link ganha 30% off no 1º mês (cupom Stripe AMIGOPRO30,
 *     digitado no Checkout — `allow_promotion_codes: true` já está ligado).
 *   - Quando o referido paga, o referrer ganha R$ 25 em customer.balance
 *     no Stripe (abate na próxima fatura). Acumula sem limite.
 *
 * Brand: paper #F5F1E8 + ink #0A0908 + REC coral #FF3D2E. Brutalist
 * (border 1.5px ink + shadow 4px 4px 0 ink). Geist Mono pra eyebrow,
 * Instrument Serif pro display.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useNeonSession, getJwtToken } from "@/lib/auth-client";

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://radar.kaleidos.com.br";

type MeResponse = {
  code: string;
  signupCount: number;
  conversionCount: number;
  totalCreditCents: number;
};

type ReferralItem = {
  id: string;
  email: string;
  status: "pending" | "signup" | "converted" | "expired";
  signupAt: string | null;
  conversionAt: string | null;
  rewardAmountCents: number;
  rewardApplied: boolean;
  createdAt: string;
};

function formatBrl(cents: number): string {
  const v = cents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

/**
 * Cada conversão = 1 mês grátis (reward = 1× preço Pro mensal). Conta os
 * meses acumulados a partir do total em centavos dividido pelo reward médio.
 * Se nunca houve conversão (rewardCents=0), retorna 0.
 */
function formatProMonths(totalCents: number, rewardPerConversionCents: number): string {
  if (rewardPerConversionCents <= 0) return "0 meses";
  const months = Math.round(totalCents / rewardPerConversionCents);
  return months === 1 ? "1 mês grátis" : `${months} meses grátis`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function statusLabel(status: ReferralItem["status"]): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (status) {
    case "converted":
      return { label: "Pago — crédito ativo", bg: "#7CB342", fg: "#0A0908" };
    case "signup":
      return { label: "Cadastrado", bg: "#F0B33C", fg: "#0A0908" };
    case "pending":
      return {
        label: "Aguardando",
        bg: "rgba(10,9,8,0.06)",
        fg: "#0A0908",
      };
    case "expired":
    default:
      return {
        label: "Expirado",
        bg: "rgba(10,9,8,0.04)",
        fg: "#6B6660",
      };
  }
}

export default function ReferralsPage() {
  const session = useNeonSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<ReferralItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (session.isPending) return;
    if (!session.data?.user) {
      setLoading(false);
      setError("Faça login pra ver suas indicações.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getJwtToken();
        if (!token) throw new Error("token_missing");
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        const [meRes, listRes] = await Promise.all([
          fetch("/api/referrals/me", { headers }),
          fetch("/api/referrals/list", { headers }),
        ]);
        if (!meRes.ok) throw new Error(`me ${meRes.status}`);
        if (!listRes.ok) throw new Error(`list ${listRes.status}`);
        const meData = (await meRes.json()) as MeResponse;
        const listData = (await listRes.json()) as { items: ReferralItem[] };
        if (cancelled) return;
        setMe(meData);
        setItems(listData.items);
      } catch (e) {
        if (cancelled) return;
        console.error("[referrals page] erro:", e);
        setError(
          "Não consegui carregar suas indicações. Tenta de novo daqui a pouco.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.isPending, session.data?.user]);

  const link = useMemo(() => {
    if (!me?.code) return "";
    return `${APP_URL}/?ref=${me.code}`;
  }, [me]);

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Falhou copiar — tenta selecionar manualmente.");
    }
  }

  async function handleShare() {
    if (!link) return;
    const text = `Tô usando o Radar Viral pra acompanhar tendências cross-platform — usa meu link e ganha 30% off no primeiro mês: ${link}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (
          navigator as Navigator & { share: (data: ShareData) => Promise<void> }
        ).share({
          title: "Radar Viral",
          text,
          url: link,
        });
        return;
      } catch {
        /* user cancelled — fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada — cola onde quiser.");
    } catch {
      /* ignore */
    }
  }

  return (
    <div style={{ padding: "32px 24px 64px" }}>
      <div className="mx-auto w-full" style={{ maxWidth: 920 }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/app/settings"
            className="rdv-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={12} /> Configurações
          </Link>
        </div>

        {/* Header */}
        <header style={{ marginBottom: 28 }}>
          <div className="rdv-eyebrow" style={{ marginBottom: 10 }}>
            <Gift size={13} /> INDIQUE E GANHE
          </div>
          <h1
            className="rdv-display"
            style={{
              fontSize: 44,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--color-rdv-ink)",
              margin: 0,
            }}
          >
            R$ 25 de crédito por <em>cada amigo</em> que assinar.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-rdv-ink)",
              lineHeight: 1.55,
              marginTop: 12,
              maxWidth: 640,
            }}
          >
            Compartilhe seu link. Quem entra com ele ganha{" "}
            <strong>30% off no primeiro mês</strong>. Quando o pagamento dele
            cai, <strong>R$ 25,00</strong> entram no seu saldo Stripe e abatem
            automaticamente na próxima fatura. Sem limite — pode acumular o
            quanto quiser.
          </p>
        </header>

        {/* Hero — link grande copiável */}
        {loading ? (
          <div
            className="rdv-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 24,
              marginBottom: 28,
              background: "var(--color-rdv-cream)",
              border: "1.5px solid var(--color-rdv-ink)",
              boxShadow: "4px 4px 0 0 var(--color-rdv-ink)",
            }}
          >
            <Loader2 size={16} className="rdv-spin" />
            <span className="rdv-mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--color-rdv-muted)" }}>
              CARREGANDO SEU LINK…
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              padding: 22,
              marginBottom: 28,
              border: "1.5px solid var(--color-rdv-rec)",
              background: "rgba(255, 61, 46, 0.06)",
              fontSize: 14,
              color: "var(--color-rdv-ink)",
            }}
          >
            {error}
          </div>
        ) : (
          me && (
            <div
              style={{
                marginBottom: 36,
                padding: "26px 28px",
                background: "var(--color-rdv-rec)",
                color: "var(--color-rdv-cream)",
                border: "2px solid var(--color-rdv-ink)",
                boxShadow: "6px 6px 0 0 var(--color-rdv-ink)",
              }}
            >
              <div
                className="rdv-mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--color-rdv-cream)",
                  fontWeight: 700,
                  marginBottom: 8,
                  opacity: 0.85,
                }}
              >
                ● SEU LINK DE INDICAÇÃO
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--color-rdv-cream)",
                  marginBottom: 18,
                  wordBreak: "break-all",
                }}
              >
                {link}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "11px 20px",
                    background: "var(--color-rdv-ink)",
                    color: "var(--color-rdv-cream)",
                    border: "1.5px solid var(--color-rdv-ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "3px 3px 0 0 rgba(0,0,0,0.25)",
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={14} /> COPIADO
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> COPIAR LINK
                    </>
                  )}
                </button>
                <button
                  onClick={handleShare}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "11px 20px",
                    background: "transparent",
                    color: "var(--color-rdv-cream)",
                    border: "1.5px solid var(--color-rdv-cream)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Share2 size={14} /> COMPARTILHAR
                </button>
              </div>
            </div>
          )
        )}

        {/* Stat cards */}
        {me && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 36,
            }}
          >
            <StatCard
              icon={<Users size={14} />}
              label="INDICADOS"
              value={String(me.signupCount)}
              hint="Cadastraram com seu link"
            />
            <StatCard
              icon={<TrendingUp size={14} />}
              label="CONVERSÕES"
              value={String(me.conversionCount)}
              hint="Pagaram primeira fatura"
            />
            <StatCard
              icon={<Wallet size={14} />}
              label="MESES GRÁTIS DE PRO"
              value={
                me.conversionCount > 0
                  ? formatProMonths(
                      me.totalCreditCents,
                      Math.round(me.totalCreditCents / me.conversionCount),
                    )
                  : "0 meses"
              }
              hint={`= ${formatBrl(me.totalCreditCents)} em crédito Stripe (abate auto na próxima fatura)`}
              highlight
            />
          </div>
        )}

        {/* Tabela */}
        <section>
          <h2
            className="rdv-display"
            style={{
              fontSize: 22,
              color: "var(--color-rdv-ink)",
              letterSpacing: "-0.01em",
              margin: "0 0 14px",
            }}
          >
            Histórico de indicações
          </h2>
          {!items || items.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                border: "1.5px dashed var(--color-rdv-ink)",
                background: "rgba(10,9,8,0.02)",
              }}
            >
              <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", margin: 0 }}>
                Ainda sem indicações. Cola seu link em qualquer rede que você
                usa — cada amigo que assinar vale <strong>1 mês grátis de Pro</strong>.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflow: "hidden",
                border: "1.5px solid var(--color-rdv-ink)",
                background: "var(--color-rdv-cream)",
                boxShadow: "3px 3px 0 0 var(--color-rdv-ink)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "var(--color-rdv-ink)",
                      color: "var(--color-rdv-cream)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "12px 14px" }}>Quando</th>
                    <th style={{ padding: "12px 14px" }}>Email</th>
                    <th style={{ padding: "12px 14px" }}>Status</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>
                      Recompensa
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const s = statusLabel(row.status);
                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderTop:
                            idx === 0
                              ? "none"
                              : "1px solid rgba(10,9,8,0.08)",
                          fontSize: 13.5,
                          color: "var(--color-rdv-ink)",
                        }}
                      >
                        <td style={{ padding: "13px 14px" }}>
                          {formatDate(
                            row.conversionAt || row.signupAt || row.createdAt,
                          )}
                        </td>
                        <td
                          style={{
                            padding: "13px 14px",
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                          }}
                        >
                          {row.email}
                        </td>
                        <td style={{ padding: "13px 14px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "3px 10px",
                              background: s.bg,
                              color: s.fg,
                              fontFamily: "var(--font-mono)",
                              fontSize: 9.5,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              fontWeight: 700,
                            }}
                          >
                            {s.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "13px 14px",
                            textAlign: "right",
                            fontFamily: "var(--font-mono)",
                            fontSize: 13,
                            fontWeight: 700,
                            color:
                              row.status === "converted"
                                ? "var(--color-rdv-ink)"
                                : "var(--color-rdv-muted)",
                          }}
                        >
                          {row.rewardApplied
                            ? `+ ${formatBrl(row.rewardAmountCents)}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Regras */}
        <aside
          style={{
            marginTop: 32,
            padding: 22,
            border: "1.5px solid var(--color-rdv-ink)",
            background: "rgba(10,9,8,0.03)",
          }}
        >
          <div
            className="rdv-mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            COMO FUNCIONA
          </div>
          <ul
            style={{
              fontSize: 13.5,
              color: "var(--color-rdv-ink)",
              lineHeight: 1.6,
              margin: 0,
              paddingLeft: 18,
            }}
          >
            <li>
              <strong>1.</strong> Seu amigo clica no seu link e digita o cupom{" "}
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  background: "var(--color-rdv-rec)",
                  color: "var(--color-rdv-cream)",
                  padding: "1px 6px",
                  fontWeight: 700,
                }}
              >
                AMIGOPRO30
              </code>{" "}
              no Checkout — ganha 30% off no primeiro mês.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>2.</strong> Quando o pagamento dele cai, você ganha{" "}
              <strong>R$ 25 de crédito</strong> direto no Stripe.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>3.</strong> Esse crédito abate automático na sua próxima
              fatura. Acumula sem teto — chame 10 amigos, pague 10 meses de
              menos.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>4.</strong> Auto-indicação não vale (a gente bloqueia). Link
              tem validade de 30 dias no navegador do convidado.
            </li>
          </ul>
        </aside>
      </div>

      <style jsx global>{`
        .rdv-spin {
          animation: rdv-spin 0.9s linear infinite;
        }
        @keyframes rdv-spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 18,
        border: "1.5px solid var(--color-rdv-ink)",
        background: highlight
          ? "var(--color-rdv-rec)"
          : "var(--color-rdv-cream)",
        color: highlight ? "var(--color-rdv-cream)" : "var(--color-rdv-ink)",
        boxShadow: "3px 3px 0 0 var(--color-rdv-ink)",
      }}
    >
      <div
        className="rdv-mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          opacity: highlight ? 0.9 : 1,
        }}
      >
        {icon} {label}
      </div>
      <div
        className="rdv-display"
        style={{
          fontSize: 30,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11.5,
          marginTop: 4,
          opacity: highlight ? 0.85 : 0.7,
        }}
      >
        {hint}
      </div>
    </div>
  );
}
