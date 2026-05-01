"use client";

/**
 * /app/instagram — IG Radar v2.
 *
 * Grid de posts do nicho ativo com viral score + filtros + sort.
 * Lê /api/data/instagram/posts (popula via cron v1).
 */

import { useEffect, useState, useMemo } from "react";
import {
  Heart,
  MessageSquare,
  Eye,
  Flame,
  Image as ImageIcon,
  Video,
  Layers,
  RefreshCw,
  Search,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import { igPostScore, igScoreTier } from "@/lib/ig-score";
import type { InstagramPostRow } from "@/app/api/data/instagram/posts/route";

type TabId = "all" | "reels" | "carousel" | "image";
type SortBy = "score" | "recent" | "likes";

export default function InstagramPage() {
  const { active: niche } = useActiveNiche();
  const [posts, setPosts] = useState<InstagramPostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/instagram/posts?niche=${niche.id}&limit=120`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { posts: InstagramPostRow[] };
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
    if (tab === "reels") result = result.filter((p) => p.type === "Video" || Boolean(p.video_url));
    else if (tab === "carousel") result = result.filter((p) => (p.child_urls?.length ?? 0) > 1);
    else if (tab === "image") result = result.filter((p) => p.type === "Image" && (p.child_urls?.length ?? 0) <= 1);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => [p.account_handle, p.caption ?? ""].join(" ").toLowerCase().includes(q));
    }
    if (sortBy === "score") return [...result].sort((a, b) => igPostScore(b) - igPostScore(a));
    if (sortBy === "recent")
      return [...result].sort((a, b) => {
        const ta = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        const tb = b.posted_at ? new Date(b.posted_at).getTime() : 0;
        return tb - ta;
      });
    return [...result].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  }, [posts, tab, sortBy, search]);

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> IG RADAR · {niche.label.toUpperCase()}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <h1 className="rdv-display" style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          Posts do <em>{niche.label}</em> trackados.
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
        <SubTabs value={tab} onChange={setTab} counts={getCounts(posts)} />
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
          <option value="score">Sort: viral score</option>
          <option value="recent">Sort: recente</option>
          <option value="likes">Sort: likes</option>
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
            placeholder="Buscar handle ou caption…"
            style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13 }}
          />
        </div>
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

      {!loading && filteredPosts.length === 0 && posts.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 12 }}>
            Sem posts pra esse nicho ainda.
          </p>
          <p
            className="rdv-mono"
            style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-rdv-muted)" }}
          >
            Cron `/api/cron/refresh` da v1 popula às 9h UTC todo dia
          </p>
        </div>
      )}

      {filteredPosts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {filteredPosts.map((post) => (
            <PostCard key={post.shortcode} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}

// ─── Components ─────────────────────────────────────────────────────────

function getCounts(posts: InstagramPostRow[]) {
  return {
    all: posts.length,
    reels: posts.filter((p) => p.type === "Video" || Boolean(p.video_url)).length,
    carousel: posts.filter((p) => (p.child_urls?.length ?? 0) > 1).length,
    image: posts.filter((p) => p.type === "Image" && (p.child_urls?.length ?? 0) <= 1).length,
  };
}

function SubTabs({
  value,
  onChange,
  counts,
}: {
  value: TabId;
  onChange: (v: TabId) => void;
  counts: { all: number; reels: number; carousel: number; image: number };
}) {
  const tabs: Array<{ id: TabId; label: string; n: number; icon: React.ReactNode }> = [
    { id: "all", label: "Todos", n: counts.all, icon: null },
    { id: "reels", label: "Reels", n: counts.reels, icon: <Video size={11} /> },
    { id: "carousel", label: "Carrosséis", n: counts.carousel, icon: <Layers size={11} /> },
    { id: "image", label: "Imagens", n: counts.image, icon: <ImageIcon size={11} /> },
  ];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
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
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: active ? "2px 2px 0 0 var(--color-rdv-rec)" : "none",
            }}
          >
            {t.icon}
            {t.label}
            <span style={{ opacity: 0.7, fontWeight: 500 }}>· {t.n}</span>
          </button>
        );
      })}
    </div>
  );
}

function PostCard({ post }: { post: InstagramPostRow }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const url = `https://instagram.com/p/${post.shortcode}/`;
  const isCarousel = (post.child_urls?.length ?? 0) > 1;
  const isVideo = post.type === "Video" || Boolean(post.video_url);
  const score = igPostScore(post);
  const tier = igScoreTier(score);
  const slides = isCarousel && post.child_urls
    ? post.child_urls.filter((u): u is string => Boolean(u))
    : [post.display_url ?? ""];
  const currentSlide = slides[slideIdx] ?? post.display_url;

  const fmt = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  };

  function navSlide(e: React.MouseEvent, dir: 1 | -1) {
    e.preventDefault();
    e.stopPropagation();
    setSlideIdx((i) => {
      const next = i + dir;
      if (next < 0) return slides.length - 1;
      if (next >= slides.length) return 0;
      return next;
    });
  }

  return (
    <div className="rdv-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column", padding: 0 }}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{ textDecoration: "none", color: "inherit", flex: 1, display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            position: "relative",
            aspectRatio: isVideo ? "9/16" : "4/5",
            background: currentSlide
              ? `url(${currentSlide}) center/cover`
              : "linear-gradient(135deg, #2a1a14, #1a1a1a)",
            borderBottom: "1.5px solid var(--color-rdv-ink)",
          }}
        >
          {score >= 50 && (
            <span
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                background: tier.color,
                color: "white",
                padding: "3px 6px",
                fontSize: 9,
                fontFamily: "var(--font-geist-mono)",
                fontWeight: 800,
                letterSpacing: "0.1em",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
              title={`Score ${score} · ${tier.label}`}
            >
              <Flame size={9} /> {score}
            </span>
          )}
          {isVideo && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                background: "rgba(0,0,0,0.65)",
                color: "white",
                padding: 4,
                display: "flex",
              }}
            >
              <Video size={11} />
            </span>
          )}
          {isCarousel && slides.length > 1 && (
            <>
              <button type="button" onClick={(e) => navSlide(e, -1)} style={arrowStyle("left")} aria-label="Anterior">
                ‹
              </button>
              <button type="button" onClick={(e) => navSlide(e, 1)} style={arrowStyle("right")} aria-label="Próximo">
                ›
              </button>
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 3,
                }}
              >
                {slides.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: i === slideIdx ? "white" : "rgba(255,255,255,0.4)",
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
            <span>@{post.account_handle}</span>
            <ExternalLink size={10} style={{ opacity: 0.5, marginLeft: "auto" }} />
          </div>
          {post.caption && (
            <p
              style={{
                fontSize: 11.5,
                color: "var(--color-rdv-muted)",
                lineHeight: 1.4,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {post.caption}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 10,
              fontSize: 10.5,
              color: "var(--color-rdv-muted)",
              marginTop: 2,
              fontFamily: "var(--font-geist-mono)",
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
            {post.views > 0 && (
              <span title="Views">
                <Eye size={10} style={{ display: "inline", marginRight: 2 }} />
                {fmt(post.views)}
              </span>
            )}
          </div>
        </div>
      </a>
    </div>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 6,
    transform: "translateY(-50%)",
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.6)",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  };
}
