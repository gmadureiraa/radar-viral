"use client";

/**
 * /app/threads — Threads Radar v2.
 *
 * Lê /api/data/threads (popula via cron `/api/cron/scrape-threads`, Phase 2).
 * Estrutura espelha /app/instagram, mas Threads é texto-first: card maior
 * com caption full + métricas (replies/likes/reposts) + link externo.
 *
 * Sem post-detail-modal (kind 'threads' ainda não suportado pelo modal),
 * card abre o post no Threads em nova aba.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  MessageSquare,
  Repeat2,
  RefreshCw,
  Search,
  ExternalLink,
  AtSign,
} from "lucide-react";
import Link from "next/link";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import { imgProxy } from "@/lib/img-proxy";
import { SkeletonCard } from "@/components/skeleton-card";
import type { ThreadsPostRow } from "@/app/api/data/threads/route";

type SortBy = "recent" | "likes" | "engagement";

export default function ThreadsPage() {
  const { active: niche } = useActiveNiche();
  const [posts, setPosts] = useState<ThreadsPostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/threads?niche=${niche.id}&days=7&limit=120`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { posts: ThreadsPostRow[] };
      setPosts(data.posts ?? []);
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

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => [p.account_handle, p.caption ?? ""].join(" ").toLowerCase().includes(q));
    }
    if (sortBy === "likes") {
      return [...result].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    }
    if (sortBy === "engagement") {
      return [...result].sort(
        (a, b) =>
          (b.likes ?? 0) + (b.replies ?? 0) + (b.reposts ?? 0) -
          ((a.likes ?? 0) + (a.replies ?? 0) + (a.reposts ?? 0)),
      );
    }
    return [...result].sort((a, b) => {
      const ta = a.posted_at ? new Date(a.posted_at).getTime() : 0;
      const tb = b.posted_at ? new Date(b.posted_at).getTime() : 0;
      return tb - ta;
    });
  }, [posts, sortBy, search]);

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> THREADS RADAR · {niche.label.toUpperCase()}
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
          Posts do <em>{niche.label}</em> no Threads.
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
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          style={{
            padding: "8px 12px",
            border: "1.5px solid var(--color-rdv-ink)",
            background: "var(--color-rdv-card)",
            fontFamily: "var(--font-geist-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          <option value="recent">Sort: recente</option>
          <option value="likes">Sort: likes</option>
          <option value="engagement">Sort: engajamento</option>
        </select>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            border: "1.5px solid var(--color-rdv-ink)",
            background: "var(--color-rdv-card)",
            flex: "1 1 240px",
            maxWidth: 320,
          }}
        >
          <Search size={14} style={{ marginLeft: 12, color: "var(--color-rdv-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar handle ou caption…"
            style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13 }}
          />
        </div>
        <span
          className="rdv-mono"
          style={{
            fontSize: 10.5,
            color: "var(--color-rdv-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {filteredPosts.length} posts · 7d
        </span>
      </div>

      {error && (
        <div className="rdv-card" style={{ padding: 20, marginBottom: 18, borderColor: "var(--color-rdv-rec)" }}>
          ⚠️ {error}
        </div>
      )}

      {loading && posts.length === 0 && (
        <div
          role="status"
          aria-label="Carregando posts do Threads"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} media={false} />
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 10 }}>
            Sem posts do Threads pra esse nicho ainda.
          </p>
          <p
            className="rdv-mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
              marginBottom: 16,
            }}
          >
            Adicione fontes Threads em Ajustes pra ativar o cron diário (12h UTC).
          </p>
          <Link
            href="/app/settings"
            className="rdv-btn"
            style={{ padding: "10px 16px", fontSize: 11, display: "inline-flex" }}
          >
            <AtSign size={12} /> Configurar fontes Threads
          </Link>
        </div>
      )}

      {filteredPosts.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {filteredPosts.map((post) => (
            <ThreadsCard key={post.post_id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}

// ─── Components ─────────────────────────────────────────────────────────

function ThreadsCard({ post }: { post: ThreadsPostRow }) {
  const handle = post.account_handle.replace(/^@/, "");
  const url = `https://www.threads.net/@${handle}/post/${post.post_id}`;
  const firstMedia = post.media_url && post.media_url.length > 0 ? post.media_url[0] : null;

  const fmt = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  };

  const postedRel = post.posted_at ? formatRelative(post.posted_at) : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rdv-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 14px 12px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--color-rdv-ink)",
            color: "var(--color-rdv-paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          @
        </span>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>@{handle}</span>
          {postedRel && (
            <span
              className="rdv-mono"
              style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--color-rdv-muted)" }}
            >
              {postedRel}
            </span>
          )}
        </div>
        <ExternalLink size={11} style={{ opacity: 0.45, flexShrink: 0 }} />
      </div>

      {post.caption && (
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.45,
            color: "var(--color-rdv-ink)",
            display: "-webkit-box",
            WebkitLineClamp: 6,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.caption}
        </p>
      )}

      {firstMedia && (
        <div
          style={{
            position: "relative",
            aspectRatio: "4/5",
            background: "var(--color-rdv-paper)",
            border: "1.5px solid var(--color-rdv-ink)",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgProxy(firstMedia)}
            alt=""
            loading="lazy"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 14,
          fontSize: 11,
          color: "var(--color-rdv-muted)",
          fontFamily: "var(--font-geist-mono)",
          marginTop: "auto",
          paddingTop: 4,
        }}
      >
        <span title="Replies">
          <MessageSquare size={11} style={{ display: "inline", marginRight: 3 }} />
          {fmt(post.replies ?? 0)}
        </span>
        <span title="Likes">
          <Heart size={11} style={{ display: "inline", marginRight: 3 }} />
          {fmt(post.likes ?? 0)}
        </span>
        <span title="Reposts">
          <Repeat2 size={11} style={{ display: "inline", marginRight: 3 }} />
          {fmt(post.reposts ?? 0)}
        </span>
      </div>
    </a>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d atrás`;
  const w = Math.floor(d / 7);
  return `${w}sem atrás`;
}
