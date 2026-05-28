"use client";

/**
 * /app/trends — Tendências do nicho. Agrega padrões da janela (7d default)
 * sobre os dados que a v1 já coleta. ZERO scrape novo.
 *
 * Lê /api/data/trends?niche=&days=. Mostra hashtags em alta, contas que
 * mais bombaram, distribuição por formato e melhores horários (BRT).
 */

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  RefreshCw,
  Hash,
  AtSign,
  Clock,
  Layers,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import type { TrendsResponse } from "@/app/api/data/trends/route";

type Window = 7 | 14 | 30;

function fmt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

const FORMAT_META: Record<
  string,
  { label: string; icon: typeof Film }
> = {
  reel: { label: "Reels", icon: Film },
  carousel: { label: "Carrosséis", icon: Layers },
  image: { label: "Imagens", icon: ImageIcon },
};

export default function TrendsPage() {
  const { active: niche } = useActiveNiche();
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Window>(7);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/trends?niche=${niche.id}&days=${days}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setData((await res.json()) as TrendsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche.id, days]);

  const maxHashtag = useMemo(
    () => Math.max(1, ...(data?.hashtags ?? []).map((h) => h.posts)),
    [data],
  );
  const maxHour = useMemo(
    () => Math.max(1, ...(data?.hours ?? []).map((h) => h.avg_engagement)),
    [data],
  );
  const totalFormats = useMemo(
    () => (data?.formats ?? []).reduce((s, f) => s + f.posts, 0),
    [data],
  );

  const empty = !loading && data && data.summary.posts === 0;

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> TENDÊNCIAS · {niche.label.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <h1
          className="rdv-display"
          style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
        >
          O que <em>repete</em> na semana.
        </h1>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {([7, 14, 30] as Window[]).map((d) => {
              const active = d === days;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  aria-pressed={active}
                  style={{
                    padding: "8px 12px",
                    border: "1.5px solid var(--color-rdv-ink)",
                    background: active ? "var(--color-rdv-ink)" : "var(--color-rdv-card)",
                    color: active ? "var(--color-rdv-paper)" : "var(--color-rdv-ink)",
                    cursor: "pointer",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    boxShadow: active ? "2px 2px 0 0 var(--color-rdv-rec)" : "none",
                  }}
                >
                  {d}D
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "10px 14px", fontSize: 11 }}
          >
            <RefreshCw size={12} className={loading ? "rdv-spin" : ""} />
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rdv-card" style={{ padding: 16, marginBottom: 18, color: "var(--color-rdv-rec)" }}>
          Falha ao carregar tendências: {error}
        </div>
      )}

      {/* Summary strip */}
      {data && !empty && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <StatCard label="Posts analisados" value={fmt(data.summary.posts)} />
          <StatCard label="Contas no radar" value={fmt(data.summary.accounts)} />
          <StatCard label="Engajamento total" value={fmt(data.summary.total_engagement)} />
        </div>
      )}

      {empty && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <TrendingUp size={28} style={{ margin: "0 auto 12px", color: "var(--color-rdv-muted)" }} />
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)" }}>
            Sem posts suficientes nessa janela. Volta quando o radar coletar mais sinais.
          </p>
        </div>
      )}

      {data && !empty && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {/* Hashtags */}
          <Panel icon={Hash} title="Hashtags em alta">
            {data.hashtags.length === 0 ? (
              <Muted>Sem hashtags na janela.</Muted>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {data.hashtags.slice(0, 12).map((h) => (
                  <div key={h.tag}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>#{h.tag}</span>
                      <span className="rdv-mono" style={{ fontSize: 10, color: "var(--color-rdv-muted)" }}>
                        {h.posts} posts · {fmt(h.avg_engagement)} méd
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--color-rdv-soft)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(h.posts / maxHashtag) * 100}%`,
                          background: "var(--color-rdv-rec)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Accounts */}
          <Panel icon={AtSign} title="Contas que bombaram">
            {data.accounts.length === 0 ? (
              <Muted>Sem contas na janela.</Muted>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {data.accounts.slice(0, 10).map((a, i) => (
                  <a
                    key={a.account_handle}
                    href={`https://www.instagram.com/${a.account_handle}/`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 8px",
                      textDecoration: "none",
                      color: "var(--color-rdv-ink)",
                      borderBottom: "1px solid var(--color-rdv-line)",
                    }}
                  >
                    <span className="rdv-mono" style={{ fontSize: 11, color: "var(--color-rdv-muted)", width: 18 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      @{a.account_handle}
                    </span>
                    <span className="rdv-mono" style={{ fontSize: 10, color: "var(--color-rdv-muted)" }}>
                      {fmt(a.avg_engagement)}/post
                    </span>
                  </a>
                ))}
              </div>
            )}
          </Panel>

          {/* Formats */}
          <Panel icon={Layers} title="Formato que performa">
            {data.formats.length === 0 ? (
              <Muted>Sem dados de formato.</Muted>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {data.formats.map((f) => {
                  const meta = FORMAT_META[f.format] ?? FORMAT_META.image;
                  const Icon = meta.icon;
                  const pct = totalFormats > 0 ? Math.round((f.posts / totalFormats) * 100) : 0;
                  return (
                    <div key={f.format}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Icon size={14} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{meta.label}</span>
                        <span className="rdv-mono" style={{ fontSize: 10, color: "var(--color-rdv-muted)" }}>
                          {pct}% · {fmt(f.avg_likes)} likes méd
                        </span>
                      </div>
                      <div style={{ height: 6, background: "var(--color-rdv-soft)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-rdv-ink)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Best hours */}
          <Panel icon={Clock} title="Melhores horários (BRT)">
            {data.hours.length === 0 ? (
              <Muted>Sem dados de horário.</Muted>
            ) : (
              <div style={{ display: "grid", gap: 5 }}>
                {[...data.hours]
                  .sort((a, b) => b.avg_engagement - a.avg_engagement)
                  .slice(0, 8)
                  .map((h) => (
                    <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="rdv-mono" style={{ fontSize: 11, fontWeight: 700, width: 42 }}>
                        {String(h.hour).padStart(2, "0")}h
                      </span>
                      <div style={{ flex: 1, height: 8, background: "var(--color-rdv-soft)" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${(h.avg_engagement / maxHour) * 100}%`,
                            background: "var(--color-rdv-rec)",
                          }}
                        />
                      </div>
                      <span className="rdv-mono" style={{ fontSize: 10, color: "var(--color-rdv-muted)", width: 56, textAlign: "right" }}>
                        {fmt(h.avg_engagement)} · {h.posts}p
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {loading && !data && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <div className="rdv-eyebrow" style={{ justifyContent: "center" }}>
            <span className="rdv-rec-dot" /> CARREGANDO TENDÊNCIAS…
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rdv-card" style={{ padding: "14px 16px" }}>
      <div
        className="rdv-mono"
        style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-rdv-muted)", marginBottom: 4 }}
      >
        {label}
      </div>
      <div className="rdv-display" style={{ fontSize: 28, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Hash;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rdv-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Icon size={16} />
        <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: "var(--color-rdv-muted)" }}>{children}</p>;
}
