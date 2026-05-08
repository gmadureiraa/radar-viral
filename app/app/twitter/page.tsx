"use client";

/**
 * /app/twitter — X/Twitter Radar.
 *
 * Lista tweets do nicho ativo com métricas (likes, retweets, replies,
 * views, quotes). Lê /api/data/twitter (popula via cron scrape-twitter,
 * Pro/Max only).
 *
 * Card mais simples que IG porque tweet é principalmente texto + métricas.
 * Link clicável vai pra https://twitter.com/<handle>/status/<tweet_id>.
 */

import { useEffect, useState, useMemo } from "react";
import {
  Heart,
  MessageSquare,
  Repeat2,
  Eye,
  Quote,
  RefreshCw,
  Search,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import type { TwitterPostRow } from "@/app/api/data/twitter/route";

type SortBy = "engagement" | "recent" | "likes" | "views";

export default function TwitterPage() {
  const { active: niche } = useActiveNiche();
  const [posts, setPosts] = useState<TwitterPostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("engagement");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<number>(7);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/twitter?niche=${niche.id}&limit=120&days=${days}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { posts: TwitterPostRow[] };
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
  }, [niche.id, days]);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        [p.account_handle, p.text ?? ""].join(" ").toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      if (sortBy === "engagement") {
        const ea = (a.like_count ?? 0) + (a.retweet_count ?? 0) * 2 + (a.reply_count ?? 0);
        const eb = (b.like_count ?? 0) + (b.retweet_count ?? 0) * 2 + (b.reply_count ?? 0);
        return eb - ea;
      }
      if (sortBy === "recent") {
        const ta = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        const tb = b.posted_at ? new Date(b.posted_at).getTime() : 0;
        return tb - ta;
      }
      if (sortBy === "views") return (b.view_count ?? 0) - (a.view_count ?? 0);
      return (b.like_count ?? 0) - (a.like_count ?? 0);
    });
  }, [posts, sortBy, search]);

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> X RADAR · {niche.label.toUpperCase()}
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
          Tweets do <em>{niche.label}</em> trackados.
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
          style={selectStyle}
        >
          <option value="engagement">Sort: engajamento</option>
          <option value="recent">Sort: recente</option>
          <option value="likes">Sort: likes</option>
          <option value="views">Sort: views</option>
        </select>
        <select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          style={selectStyle}
        >
          <option value="1">Últimas 24h</option>
          <option value="3">Últimos 3d</option>
          <option value="7">Últimos 7d</option>
          <option value="30">Últimos 30d</option>
          <option value="90">Últimos 90d</option>
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
            placeholder="Buscar handle ou texto…"
            style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13 }}
          />
        </div>
      </div>

      {error && (
        <div
          className="rdv-card"
          style={{ padding: 20, marginBottom: 18, borderColor: "var(--color-rdv-rec)" }}
        >
          ⚠️ {error}
        </div>
      )}

      {loading && posts.length === 0 && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {!loading && filteredPosts.length === 0 && posts.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 12 }}>
            Sem tweets pra esse nicho ainda.
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
            X scraping é Pro. Adicione handles em Ajustes › Fontes › X/Twitter
          </p>
          <Link
            href="/app/settings"
            className="rdv-btn"
            style={{ padding: "10px 18px", fontSize: 11, display: "inline-flex" }}
          >
            Ir pra Ajustes
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
            <TweetCard key={post.tweet_id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1.5px solid var(--color-rdv-ink)",
  background: "white",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
};

function TweetCard({ post }: { post: TwitterPostRow }) {
  const url = `https://twitter.com/${post.account_handle.replace(/^@/, "")}/status/${post.tweet_id}`;
  const fmt = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  };
  const firstMedia = Array.isArray(post.media_urls) && post.media_urls.length > 0
    ? post.media_urls[0]
    : null;

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
        padding: 16,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700 }}>
        <span>@{post.account_handle.replace(/^@/, "")}</span>
        {post.is_quote && (
          <span
            className="rdv-mono"
            style={{
              fontSize: 8.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
              border: "1px solid var(--color-rdv-muted)",
              padding: "1px 5px",
            }}
          >
            <Quote size={9} style={{ display: "inline", marginRight: 3 }} />
            Quote
          </span>
        )}
        <ExternalLink size={11} style={{ opacity: 0.5, marginLeft: "auto" }} />
      </div>

      {post.text && (
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.45,
            color: "var(--color-rdv-ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.text}
        </p>
      )}

      {firstMedia && (
        <div
          style={{
            width: "100%",
            aspectRatio: "16/10",
            background: "var(--color-rdv-paper)",
            border: "1px solid rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firstMedia}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 14,
          fontSize: 10.5,
          color: "var(--color-rdv-muted)",
          fontFamily: "var(--font-geist-mono)",
          marginTop: 4,
          flexWrap: "wrap",
        }}
      >
        <span title="Likes">
          <Heart size={10} style={{ display: "inline", marginRight: 2 }} />
          {fmt(post.like_count ?? 0)}
        </span>
        <span title="Retweets">
          <Repeat2 size={10} style={{ display: "inline", marginRight: 2 }} />
          {fmt(post.retweet_count ?? 0)}
        </span>
        <span title="Replies">
          <MessageSquare size={10} style={{ display: "inline", marginRight: 2 }} />
          {fmt(post.reply_count ?? 0)}
        </span>
        {(post.view_count ?? 0) > 0 && (
          <span title="Views">
            <Eye size={10} style={{ display: "inline", marginRight: 2 }} />
            {fmt(post.view_count)}
          </span>
        )}
        {(post.quote_count ?? 0) > 0 && (
          <span title="Quotes">
            <Quote size={10} style={{ display: "inline", marginRight: 2 }} />
            {fmt(post.quote_count)}
          </span>
        )}
        {post.posted_at && (
          <span style={{ marginLeft: "auto", opacity: 0.7 }}>
            {new Date(post.posted_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        )}
      </div>
    </a>
  );
}
