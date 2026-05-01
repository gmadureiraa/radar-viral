"use client";

/**
 * /app/newsletters — Newsletters do nicho lidas via Gmail (cron v1).
 */

import { useEffect, useState } from "react";
import { Mail, RefreshCw, Loader2 } from "lucide-react";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
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
        <h1
          className="rdv-display"
          style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
        >
          Newsletters do <em>{niche.label}</em>.
        </h1>
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
        <div className="rdv-card" style={{ padding: 20, marginBottom: 18, borderColor: "var(--color-rdv-rec)" }}>
          ⚠️ {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <Mail size={28} style={{ margin: "0 auto 12px", color: "var(--color-rdv-muted)" }} />
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)" }}>
            Sem newsletters salvas. Cron `/api/cron/newsletters` da v1 lê Gmail diariamente.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((nl) => (
            <NewsletterRowCard key={nl.id} item={nl} />
          ))}
        </div>
      )}
    </main>
  );
}

function NewsletterRowCard({ item }: { item: NewsletterRow }) {
  const ageLabel = item.sent_at ? timeAgo(item.sent_at) : "—";
  return (
    <div className="rdv-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "2px 8px",
            background: "var(--color-rdv-soft)",
            color: "var(--color-rdv-ink)",
          }}
        >
          {item.sender_name ?? item.sender_email ?? "—"}
        </span>
        <span className="rdv-mono" style={{ fontSize: 9, color: "var(--color-rdv-muted)" }}>
          {ageLabel}
        </span>
        {item.link_count != null && item.link_count > 0 && (
          <span className="rdv-mono" style={{ fontSize: 9, color: "var(--color-rdv-muted)" }}>
            {item.link_count} link{item.link_count === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>
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
