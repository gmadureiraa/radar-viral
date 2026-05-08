"use client";

/**
 * /app/tiktok — TikTok Radar v2.
 *
 * Lê /api/data/tiktok (popula via /api/cron/scrape-tiktok, Phase 1).
 * Cards estilo grid 9:16 (cover + handle + métricas plays/likes/comments/shares).
 * Sem post-detail-modal — abre o video no TikTok em nova aba.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  MessageSquare,
  Share2,
  Play,
  RefreshCw,
  Search,
  Loader2,
  ExternalLink,
  Music2,
} from "lucide-react";
import Link from "next/link";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import { imgProxy } from "@/lib/img-proxy";
import type { TikTokPostRow } from "@/app/api/data/tiktok/route";

type SortBy = "recent" | "plays" | "engagement";

export default function TikTokPage() {
  const { active: niche } = useActiveNiche();
  const [posts, setPosts] = useState<TikTokPostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/tiktok?niche=${niche.id}&days=14&limit=120`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { posts: TikTokPostRow[] };
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
      result = result.filter((p) =>
        [p.account_handle, p.caption ?? "", p.music_name ?? ""].join(" ").toLowerCase().includes(q),
      );
    }
    if (sortBy === "plays") {
      return [...result].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0));
    }
    if (sortBy === "engagement") {
      return [...result].sort(
        (a, b) =>
          (b.likes ?? 0) + (b.comments ?? 0) + (b.shares ?? 0) -
          ((a.likes ?? 0) + (a.comments ?? 0) + (a.shares ?? 0)),
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
        <span className="rdv-rec-dot" /> TIKTOK RADAR · {niche.label.toUpperCase()}
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
          Vídeos de <em>{niche.label}</em> no TikTok.
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
            background: "white",
            fontFamily: "var(--font-geist-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          <option value="recent">Sort: recente</option>
          <option value="plays">Sort: views</option>
          <option value="engagement">Sort: engajamento</option>
        </select>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            border: "1.5px solid var(--color-rdv-ink)",
            background: "white",
            flex: "1 1 240px",
            maxWidth: 320,
          }}
        >
          <Search size={14} style={{ marginLeft: 12, color: "var(--color-rdv-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar handle, caption ou música…"
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
          {filteredPosts.length} vídeos · 14d
        </span>
      </div>

      {error && (
        <div className="rdv-card" style={{ padding: 20, marginBottom: 18, borderColor: "var(--color-rdv-rec)" }}>
          ⚠️ {error}
        </div>
      )}

      {loading && posts.length === 0 && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 10 }}>
            Sem vídeos de TikTok pra esse nicho ainda.
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
            Adicione fontes TikTok em Ajustes pra ativar o cron diário (11h UTC).
          </p>
          <Link
            href="/app/settings"
            className="rdv-btn"
            style={{ padding: "10px 16px", fontSize: 11, display: "inline-flex" }}
          >
            <Music2 size={12} /> Configurar fontes TikTok
          </Link>
        </div>
      )}

      {filteredPosts.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {filteredPosts.map((post) => (
            <TikTokCard key={post.post_id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}

// ─── Components ─────────────────────────────────────────────────────────

function TikTokCard({ post }: { post: TikTokPostRow }) {
  const handle = post.account_handle.replace(/^@/, "");
  const url = `https://www.tiktok.com/@${handle}/video/${post.post_id}`;

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
        gap: 8,
        padding: 0,
        textDecoration: "none",
        color: "inherit",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "9/16",
          background: "var(--color-rdv-ink)",
          overflow: "hidden",
        }}
      >
        {post.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgProxy(post.cover_url)}
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
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-rdv-paper)",
              opacity: 0.4,
            }}
          >
            <Music2 size={40} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(0,0,0,0.6)",
            color: "white",
            fontSize: 10.5,
            fontWeight: 700,
            padding: "3px 7px",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontFamily: "var(--font-geist-mono)",
            letterSpacing: "0.04em",
          }}
        >
          <Play size={10} fill="white" /> {fmt(post.plays ?? 0)}
        </div>
      </div>

      <div style={{ padding: "8px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>@{handle}</span>
          <ExternalLink size={10} style={{ opacity: 0.45, marginLeft: "auto" }} />
        </div>

        {post.caption && (
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.4,
              color: "var(--color-rdv-ink)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              margin: 0,
              wordBreak: "break-word",
            }}
          >
            {post.caption}
          </p>
        )}

        {post.music_name && (
          <span
            style={{
              fontSize: 10.5,
              color: "var(--color-rdv-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <Music2 size={9} /> {post.music_name}
          </span>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 10.5,
            color: "var(--color-rdv-muted)",
            fontFamily: "var(--font-geist-mono)",
            marginTop: "auto",
          }}
        >
          <span title="Likes">
            <Heart size={10} style={{ display: "inline", marginRight: 2 }} />
            {fmt(post.likes ?? 0)}
          </span>
          <span title="Comments">
            <MessageSquare size={10} style={{ display: "inline", marginRight: 2 }} />
            {fmt(post.comments ?? 0)}
          </span>
          <span title="Shares">
            <Share2 size={10} style={{ display: "inline", marginRight: 2 }} />
            {fmt(post.shares ?? 0)}
          </span>
          {postedRel && (
            <span style={{ marginLeft: "auto", letterSpacing: "0.06em" }}>{postedRel}</span>
          )}
        </div>
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
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  return `${w}sem`;
}
