"use client";

/**
 * /app/news — Notícias do nicho. Lê news_articles via /api/data/news.
 * Filtros: período (24h/72h/7d), busca, top fontes como chips.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Newspaper, RefreshCw, Search, ExternalLink, Loader2, Clock } from "lucide-react";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import { PostDetailModal, type PostDetail } from "@/components/post-detail-modal";
import { imgProxy } from "@/lib/img-proxy";
import type { NewsArticleRow } from "@/app/api/data/news/route";

type Period = "24h" | "72h" | "7d";

export default function NewsPage() {
  return (
    <Suspense fallback={null}>
      <NewsInner />
    </Suspense>
  );
}

function NewsInner() {
  const { active: niche } = useActiveNiche();
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";
  const [articles, setArticles] = useState<NewsArticleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("72h");
  const [search, setSearch] = useState(initialQuery);
  const [detail, setDetail] = useState<PostDetail | null>(null);

  useEffect(() => {
    setSearch(initialQuery);
  }, [initialQuery]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const hours = period === "24h" ? 24 : period === "72h" ? 72 : 168;
      const res = await fetch(`/api/data/news?niche=${niche.id}&hours=${hours}&limit=100`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { articles: NewsArticleRow[] };
      setArticles(data.articles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche.id, period]);

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter((a) =>
      [a.title, a.description ?? "", a.source_name ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [articles, search]);

  const sources = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of articles) map.set(a.source_name ?? "—", (map.get(a.source_name ?? "—") ?? 0) + 1);
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 8);
  }, [articles]);

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> NOTÍCIAS · {niche.label.toUpperCase()}
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
          Notícias do <em>{niche.label}</em>.
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

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["24h", "72h", "7d"] as Period[]).map((p) => {
            const active = p === period;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  padding: "8px 12px",
                  border: "1.5px solid var(--color-rdv-ink)",
                  background: active ? "var(--color-rdv-ink)" : "white",
                  color: active ? "white" : "var(--color-rdv-ink)",
                  cursor: "pointer",
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  boxShadow: active ? "2px 2px 0 0 var(--color-rdv-rec)" : "none",
                }}
              >
                <Clock size={10} style={{ display: "inline", marginRight: 4 }} />
                {p}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "1.5px solid var(--color-rdv-ink)",
            background: "white",
            flex: "1 1 240px",
            maxWidth: 360,
          }}
        >
          <Search size={14} style={{ marginLeft: 12, color: "var(--color-rdv-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca título, descrição ou fonte…"
            style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13 }}
          />
        </div>
      </div>

      {sources.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 18,
            paddingBottom: 16,
            borderBottom: "1px solid var(--color-rdv-line)",
            alignItems: "center",
          }}
        >
          <span
            className="rdv-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
              fontWeight: 700,
            }}
          >
            Top fontes:
          </span>
          {sources.map(([name, n]) => (
            <button
              key={name}
              type="button"
              onClick={() => setSearch(search === name ? "" : name)}
              style={{
                padding: "4px 10px",
                background: search === name ? "var(--color-rdv-rec)" : "var(--color-rdv-cream)",
                color: search === name ? "white" : "var(--color-rdv-ink)",
                border: "1px solid var(--color-rdv-ink)",
                fontFamily: "var(--font-geist-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              {name} <span style={{ opacity: 0.6 }}>· {n}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rdv-card" style={{ padding: 20, marginBottom: 18, borderColor: "var(--color-rdv-rec)" }}>
          ⚠️ {error}
        </div>
      )}

      {loading && articles.length === 0 && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <Newspaper size={28} style={{ margin: "0 auto 12px", color: "var(--color-rdv-muted)" }} />
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)" }}>Nenhuma notícia no período selecionado.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((article) => (
            <ArticleRow
              key={article.link}
              article={article}
              onClick={() =>
                setDetail({
                  kind: "news",
                  refId: article.link,
                  url: article.link,
                  title: article.title,
                  description: article.description,
                  thumbnail: article.thumbnail,
                  sourceName: article.source_name,
                  publishedAt: article.pub_date,
                  nicheSlug: article.niche,
                })
              }
            />
          ))}
        </div>
      )}

      <PostDetailModal detail={detail} onClose={() => setDetail(null)} />
    </main>
  );
}

function ArticleRow({ article, onClick }: { article: NewsArticleRow; onClick: () => void }) {
  const ageLabel = article.pub_date ? timeAgo(article.pub_date) : "—";
  return (
    <button
      type="button"
      onClick={onClick}
      className="rdv-card"
      style={{
        padding: 16,
        display: "flex",
        gap: 16,
        cursor: "pointer",
        textAlign: "left",
        background: "var(--color-rdv-cream)",
        color: "inherit",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translate(-1px, -1px)";
        e.currentTarget.style.boxShadow = "5px 5px 0 0 var(--color-rdv-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translate(0, 0)";
        e.currentTarget.style.boxShadow = "4px 4px 0 0 var(--color-rdv-ink)";
      }}
    >
      {article.thumbnail && (
        <div
          style={{
            flexShrink: 0,
            width: 120,
            height: 80,
            background: `url(${imgProxy(article.thumbnail)}) center/cover`,
            border: "1px solid var(--color-rdv-line)",
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          {article.source_name && (
            <span
              className="rdv-mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "2px 8px",
                background: article.source_color ?? "var(--color-rdv-soft)",
                color: article.source_color ? "white" : "var(--color-rdv-ink)",
              }}
            >
              {article.source_name}
            </span>
          )}
          <span className="rdv-mono" style={{ fontSize: 9, color: "var(--color-rdv-muted)" }}>
            {ageLabel}
          </span>
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
          {article.title}
        </h3>
        {article.description && (
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.4,
              color: "var(--color-rdv-muted)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {article.description}
          </p>
        )}
      </div>
      <ExternalLink size={14} style={{ flexShrink: 0, opacity: 0.4, marginTop: 4 }} />
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 60) return `${m}m atrás`;
  if (h < 24) return `${h}h atrás`;
  if (d < 30) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
