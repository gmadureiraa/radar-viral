"use client";

/**
 * /app/newsletters — Feed de newsletters lidas via Gmail.
 *
 * Dois modos:
 *  - User com newsletters carregadas: lista delas
 *  - User sem newsletters: explica como funciona + sugere curated subs
 */

import { useEffect, useState } from "react";
import {
  Mail,
  RefreshCw,
  Loader2,
  ExternalLink,
  Inbox,
  Sparkles,
} from "lucide-react";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import { getCuratedSources } from "@/lib/sources-curated";
import type { NewsletterRow } from "@/app/api/data/newsletters/route";

export default function NewslettersPage() {
  const { active: niche } = useActiveNiche();
  const [items, setItems] = useState<NewsletterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/newsletters?niche=${niche.id}&limit=100`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { newsletters: NewsletterRow[] };
      setItems(data.newsletters ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche.id]);

  const curated = getCuratedSources(niche.id);
  const isEmpty = !loading && items.length === 0;

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> NEWSLETTERS · {niche.label.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            className="rdv-display"
            style={{
              fontSize: "clamp(32px, 4vw, 48px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}
          >
            Newsletters do <em>{niche.label}</em>.
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", maxWidth: 600 }}>
            Toda manhã o cron lê o Gmail conectado, identifica quais emails são
            newsletters, classifica por nicho e mostra aqui — pra você não
            precisar abrir uma caixa de entrada lotada.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          <RefreshCw size={12} className={loading ? "rdv-spin" : ""} />
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {error && (
        <div
          className="rdv-card"
          style={{
            padding: 20,
            marginBottom: 18,
            borderColor: "var(--color-rdv-rec)",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {/* Empty state explicativo */}
      {isEmpty && <EmptyExplain niche={niche} curated={curated} />}

      {/* Lista de newsletters carregadas */}
      {items.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <h2 className="rdv-display" style={{ fontSize: 22, lineHeight: 1 }}>
              Últimas {items.length}
            </h2>
            <span
              className="rdv-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-rdv-muted)",
              }}
            >
              ordenadas por data
            </span>
          </div>
          <div style={{ display: "grid", gap: 12, marginBottom: 36 }}>
            {items.map((nl) => (
              <NewsletterRowCard key={nl.id} item={nl} />
            ))}
          </div>

          {/* Sugestões de curated abaixo */}
          {curated && curated.newsletterSubscribe.length > 0 && (
            <CuratedSuggestions curated={curated} compact />
          )}
        </>
      )}
    </main>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────

function EmptyExplain({
  niche,
  curated,
}: {
  niche: { id: string; label: string };
  curated: ReturnType<typeof getCuratedSources>;
}) {
  return (
    <>
      <div
        className="rdv-card"
        style={{
          padding: 28,
          marginBottom: 28,
          background: "var(--color-rdv-cream)",
          borderColor: "var(--color-rdv-ink)",
        }}
      >
        <Inbox
          size={36}
          style={{
            color: "var(--color-rdv-rec)",
            marginBottom: 14,
          }}
        />
        <h2
          className="rdv-display"
          style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 8 }}
        >
          Sem newsletters de <em>{niche.label}</em> ainda.
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--color-rdv-muted)",
            marginBottom: 14,
            maxWidth: 720,
          }}
        >
          O Radar lê uma caixa Gmail compartilhada que assina as principais
          newsletters de cada nicho. Se essa página está vazia, é porque
          nenhuma newsletter chegou ainda <em>ou</em> nenhuma das newsletters
          assinadas é classificada como <strong>{niche.label}</strong>.
        </p>
        <ul
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-rdv-muted)",
            paddingLeft: 18,
            margin: "10px 0 0 0",
          }}
        >
          <li>
            <strong style={{ color: "var(--color-rdv-ink)" }}>Free:</strong> você
            vê o feed compartilhado da Kaleidos (mesmo Gmail pra todos).
          </li>
          <li>
            <strong style={{ color: "var(--color-rdv-ink)" }}>Pro</strong>{" "}
            (em breve): vamos pedir acesso ao seu Gmail e ler{" "}
            <em>suas próprias newsletters</em>, classificando pelos seus nichos.
          </li>
        </ul>
      </div>

      {curated && curated.newsletterSubscribe.length > 0 && (
        <CuratedSuggestions curated={curated} />
      )}
    </>
  );
}

function CuratedSuggestions({
  curated,
  compact,
}: {
  curated: NonNullable<ReturnType<typeof getCuratedSources>>;
  compact?: boolean;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: compact ? 10 : 14,
          flexWrap: "wrap",
        }}
      >
        <h2
          className="rdv-display"
          style={{
            fontSize: compact ? 20 : 24,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Sparkles size={16} style={{ color: "var(--color-rdv-rec)" }} />
          Newsletters {curated.niche === "crypto" ? "de cripto" : `de ${curated.niche}`} pra assinar
        </h2>
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-rdv-muted)",
          }}
        >
          curadoria Kaleidos
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {curated.newsletterSubscribe.map((nl) => (
          <a
            key={nl.subscribeUrl}
            href={nl.subscribeUrl}
            target="_blank"
            rel="noreferrer"
            className="rdv-card"
            style={{
              padding: 14,
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
            }}
          >
            <Mail
              size={18}
              style={{ color: "var(--color-rdv-rec)", flexShrink: 0, marginTop: 2 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  marginBottom: 4,
                }}
              >
                {nl.name}
              </div>
              {nl.sender && (
                <div
                  className="rdv-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--color-rdv-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {nl.sender}
                </div>
              )}
            </div>
            <ExternalLink
              size={12}
              style={{ flexShrink: 0, opacity: 0.5, marginTop: 4 }}
            />
          </a>
        ))}
      </div>
    </section>
  );
}

// ─── Card de newsletter recebida ────────────────────────────────────────

function NewsletterRowCard({ item }: { item: NewsletterRow }) {
  const ageLabel = item.sent_at ? timeAgo(item.sent_at) : "—";
  return (
    <div className="rdv-card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "2px 8px",
            background: "var(--color-rdv-paper)",
            color: "var(--color-rdv-ink)",
            border: "1px solid var(--color-rdv-line)",
          }}
        >
          {item.sender_name ?? item.sender_email ?? "—"}
        </span>
        <span
          className="rdv-mono"
          style={{ fontSize: 9, color: "var(--color-rdv-muted)" }}
        >
          {ageLabel}
        </span>
        {item.link_count != null && item.link_count > 0 && (
          <span
            className="rdv-mono"
            style={{ fontSize: 9, color: "var(--color-rdv-muted)" }}
          >
            {item.link_count} link{item.link_count === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.3,
          marginBottom: 6,
        }}
      >
        {item.subject}
      </h3>
      {item.snippet && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--color-rdv-muted)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.snippet}
        </p>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 24) return `${h}h atrás`;
  if (d < 30) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
