"use client";

/**
 * /app/youtube — Feed de vídeos recentes. Lê tabela `videos` (cron RSS v1).
 */

import { useEffect, useState } from "react";
import { Youtube, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { useActiveNiche } from "@/lib/niche-context";
import { getJwtToken } from "@/lib/auth-client";
import { PostDetailModal, type PostDetail } from "@/components/post-detail-modal";
import type { VideoRow } from "@/app/api/data/videos/route";

export default function YouTubePage() {
  const { active: niche } = useActiveNiche();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [detail, setDetail] = useState<PostDetail | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/videos?days=${days}&limit=120`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { videos: VideoRow[] };
      setVideos(data.videos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> YOUTUBE · {niche.label.toUpperCase()}
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
          Feed do <em>YouTube</em>.
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

      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {([7, 14, 30] as const).map((d) => {
          const active = d === days;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
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
              Últimos {d}d
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rdv-card" style={{ padding: 20, marginBottom: 18, borderColor: "var(--color-rdv-rec)" }}>
          ⚠️ {error}
        </div>
      )}

      {loading && videos.length === 0 && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <Youtube size={28} style={{ margin: "0 auto 12px", color: "var(--color-rdv-muted)" }} />
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)" }}>
            Nenhum vídeo no período. Cron de RSS roda na v1.
          </p>
        </div>
      )}

      {videos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {videos.map((v) => (
            <VideoCard
              key={v.video_id}
              video={v}
              onClick={() =>
                setDetail({
                  kind: "youtube",
                  refId: v.video_id,
                  url: v.link,
                  title: v.title,
                  thumbnail: v.thumbnail_url,
                  authorName: v.channel_name,
                  publishedAt: v.published_at,
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

function VideoCard({ video, onClick }: { video: VideoRow; onClick: () => void }) {
  const ageLabel = timeAgo(video.published_at);
  return (
    <button
      type="button"
      onClick={onClick}
      className="rdv-card"
      style={{
        padding: 0,
        overflow: "hidden",
        textAlign: "left",
        cursor: "pointer",
        color: "inherit",
        background: "var(--color-rdv-cream)",
      }}
    >
      <div
        style={{
          aspectRatio: "16/9",
          background: video.thumbnail_url
            ? `url(${video.thumbnail_url}) center/cover`
            : "linear-gradient(135deg, #2a1a14, #1a1a1a)",
          borderBottom: "1.5px solid var(--color-rdv-ink)",
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: 4,
            display: "flex",
          }}
        >
          <Youtube size={11} />
        </span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div
          className="rdv-mono"
          style={{
            fontSize: 9,
            color: "var(--color-rdv-muted)",
            marginBottom: 4,
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          {video.channel_name} · {ageLabel}
        </div>
        <h3 style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
          {video.title}
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 8,
            fontSize: 10,
            color: "var(--color-rdv-muted)",
          }}
        >
          <ExternalLink size={10} /> ver detalhes
        </div>
      </div>
    </button>
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
