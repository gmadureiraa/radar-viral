"use client";

/**
 * /app/settings — gerenciar nicho ativo + visualizar catálogo de fontes.
 *
 * Catálogo é estático (lib/sources-curated). Quando user pagar (paywall),
 * fontes do nicho dele entram em `tracked_sources` e cron passa a popular.
 */

import { useState } from "react";
import { Instagram, Youtube, Newspaper, Mail, Lock, Sparkles, Check } from "lucide-react";
import Link from "next/link";
import { useActiveNiche } from "@/lib/niche-context";
import { getCuratedSources } from "@/lib/sources-curated";
import { NICHES } from "@/lib/niches";

type Category = "ig" | "youtube" | "news" | "newsletter";

export default function SettingsPage() {
  const { active, setActive } = useActiveNiche();
  const [tab, setTab] = useState<Category>("ig");
  const sources = getCuratedSources(active.id);
  const counts = sources
    ? {
        ig: sources.igHandles.length,
        youtube: sources.youtubeChannels.length,
        news: sources.newsRss.length,
        newsletter: sources.newsletterSubscribe.length,
      }
    : { ig: 0, youtube: 0, news: 0, newsletter: 0 };

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> CONFIGURAÇÕES
      </div>
      <h1
        className="rdv-display"
        style={{
          fontSize: "clamp(32px, 4vw, 48px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          marginBottom: 24,
        }}
      >
        Tuas <em>fontes</em>.
      </h1>

      {/* Nicho ativo */}
      <section style={{ marginBottom: 32 }}>
        <div className="rdv-eyebrow" style={{ marginBottom: 10 }}>
          NICHO ATIVO
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {NICHES.map((n) => {
            const isActive = n.id === active.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setActive(n.id)}
                style={{
                  padding: 16,
                  background: isActive ? `${n.color}15` : "var(--color-rdv-cream)",
                  border: `1.5px solid ${isActive ? n.color : "var(--color-rdv-ink)"}`,
                  boxShadow: isActive
                    ? `4px 4px 0 0 ${n.color}`
                    : "3px 3px 0 0 var(--color-rdv-ink)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 28 }}>{n.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{n.label}</div>
                  <div style={{ fontSize: 11, color: "var(--color-rdv-muted)", lineHeight: 1.3 }}>
                    {n.description}
                  </div>
                </div>
                {isActive && (
                  <span
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      background: n.color,
                      color: "white",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Plano free notice */}
      <section style={{ marginBottom: 28 }}>
        <div
          className="rdv-card"
          style={{
            padding: "18px 22px",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            borderColor: "var(--color-rdv-amber)",
            boxShadow: "5px 5px 0 0 var(--color-rdv-amber)",
          }}
        >
          <Lock size={20} style={{ color: "var(--color-rdv-amber)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              Você tá no plano <em>Free</em> · vendo o radar global
            </div>
            <p style={{ fontSize: 13, color: "var(--color-rdv-muted)", lineHeight: 1.5 }}>
              No grátis, você vê o radar populado pelo nosso scrape compartilhado.
              Quando assinar o <strong>Pro</strong>, ativamos o catálogo abaixo: as{" "}
              <strong>
                {counts.ig + counts.youtube + counts.news + counts.newsletter} fontes
              </strong>{" "}
              do nicho <strong>{active.label}</strong> entram em{" "}
              <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, background: "var(--color-rdv-soft)", padding: "1px 5px" }}>
                tracked_sources
              </code>{" "}
              e começam a alimentar teu DB individual.
            </p>
            <Link
              href="/app/precos"
              className="rdv-btn rdv-btn-rec"
              style={{ marginTop: 10, padding: "8px 14px", fontSize: 10 }}
            >
              <Sparkles size={11} /> Ver planos
            </Link>
          </div>
        </div>
      </section>

      {/* Catálogo de fontes */}
      {sources && (
        <section>
          <div className="rdv-eyebrow" style={{ marginBottom: 10 }}>
            CATÁLOGO DE FONTES · {active.label.toUpperCase()}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {(["ig", "youtube", "news", "newsletter"] as Category[]).map((c) => {
              const isActive = c === tab;
              const label =
                c === "ig"
                  ? "Instagram"
                  : c === "youtube"
                    ? "YouTube"
                    : c === "news"
                      ? "RSS Notícias"
                      : "Newsletters";
              const Icon =
                c === "ig" ? Instagram : c === "youtube" ? Youtube : c === "news" ? Newspaper : Mail;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTab(c)}
                  style={{
                    padding: "8px 12px",
                    border: "1.5px solid var(--color-rdv-ink)",
                    background: isActive ? "var(--color-rdv-ink)" : "white",
                    color: isActive ? "white" : "var(--color-rdv-ink)",
                    cursor: "pointer",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    boxShadow: isActive ? "2px 2px 0 0 var(--color-rdv-rec)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon size={11} /> {label}{" "}
                  <span style={{ opacity: 0.7, fontWeight: 500 }}>· {counts[c]}</span>
                </button>
              );
            })}
          </div>

          {tab === "ig" && (
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {sources.igHandles.map((h) => (
                <SourceCard
                  key={h.handle}
                  title={`@${h.handle}`}
                  subtitle={h.label}
                  detail={h.followers ? `${h.followers} seguidores` : undefined}
                  href={`https://instagram.com/${h.handle}`}
                  icon={<Instagram size={14} />}
                />
              ))}
            </div>
          )}

          {tab === "youtube" && (
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {sources.youtubeChannels.map((c) => (
                <SourceCard
                  key={c.handle}
                  title={c.handle}
                  subtitle={c.label}
                  href={`https://youtube.com/${c.handle}`}
                  icon={<Youtube size={14} />}
                />
              ))}
            </div>
          )}

          {tab === "news" && (
            <div style={{ display: "grid", gap: 8 }}>
              {sources.newsRss.map((r) => (
                <SourceCard
                  key={r.url}
                  title={r.name}
                  subtitle={r.url}
                  detail={r.lang === "pt" ? "🇧🇷 Português" : "🇺🇸 English"}
                  href={r.url}
                  icon={<Newspaper size={14} />}
                />
              ))}
            </div>
          )}

          {tab === "newsletter" && (
            <div style={{ display: "grid", gap: 8 }}>
              {sources.newsletterSubscribe.map((nl) => (
                <SourceCard
                  key={nl.subscribeUrl}
                  title={nl.name}
                  subtitle={nl.sender}
                  detail="Cadastre seu Gmail trackado pra puxar pro radar"
                  href={nl.subscribeUrl}
                  icon={<Mail size={14} />}
                  cta="Assinar →"
                />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function SourceCard({
  title,
  subtitle,
  detail,
  href,
  icon,
  cta = "Ver →",
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  href: string;
  icon: React.ReactNode;
  cta?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rdv-card"
      style={{
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          background: "var(--color-rdv-ink)",
          color: "var(--color-rdv-paper)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        {subtitle && (
          <div
            style={{
              fontSize: 11,
              color: "var(--color-rdv-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
        {detail && (
          <div
            className="rdv-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
              marginTop: 4,
              fontWeight: 700,
            }}
          >
            {detail}
          </div>
        )}
      </div>
      <span
        className="rdv-mono"
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--color-rdv-rec)",
          flexShrink: 0,
        }}
      >
        {cta}
      </span>
    </a>
  );
}
