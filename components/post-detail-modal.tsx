"use client";

/**
 * PostDetailModal — modal universal pra detalhes de IG / YouTube / News.
 *
 * Recebe um shape unificado (PostDetail) e renderiza:
 *  - Thumb grande
 *  - Título + descrição/caption
 *  - Metadata (likes, views, source, age)
 *  - Ações específicas por kind:
 *    - IG carousel/image  → Salvar / Transcrever / Recriar no SV
 *    - IG reel            → Salvar / Adaptar no Reels Viral
 *    - YouTube            → Salvar / Transcrever / Abrir
 *    - News               → Salvar / Abrir
 */

import { useEffect, useState } from "react";
import {
  X,
  Heart,
  MessageSquare,
  Eye,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Sparkles,
  Wand2,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getJwtToken } from "@/lib/auth-client";
import { imgProxy } from "@/lib/img-proxy";

type DetailKind = "instagram" | "youtube" | "news";

export interface PostDetail {
  kind: DetailKind;
  // Identificação universal
  refId: string; // shortcode IG / video_id YT / link news
  url: string; // link externo
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  // Metadata opcional
  authorName?: string | null;
  sourceName?: string | null;
  publishedAt?: string | null;
  meta?: {
    likes?: number;
    comments?: number;
    views?: number;
    duration?: number;
  };
  // Pra IG: distinguir reel vs carrossel/foto
  isReel?: boolean;
  // Niche slug do post (pra salvar)
  nicheSlug?: string;
}

interface Props {
  detail: PostDetail | null;
  onClose: () => void;
}

export function PostDetailModal({ detail, onClose }: Props) {
  const [saved, setSaved] = useState(false);
  const [savingNow, setSavingNow] = useState(false);

  // ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (detail) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, onClose]);

  // Verifica se já está salvo
  useEffect(() => {
    if (!detail) return;
    let cancel = false;
    (async () => {
      try {
        const jwt = await getJwtToken();
        const res = await fetch(`/api/data/saved?platform=${detail.kind}`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: Array<{ ref_id: string }> };
        if (cancel) return;
        setSaved(data.items.some((i) => i.ref_id === detail.refId));
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [detail]);

  if (!detail) return null;

  async function handleToggleSave() {
    if (!detail) return;
    setSavingNow(true);
    try {
      const jwt = await getJwtToken();
      if (saved) {
        // Remove
        const res = await fetch(
          `/api/data/saved?platform=${detail.kind}&refId=${encodeURIComponent(detail.refId)}`,
          {
            method: "DELETE",
            headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
          },
        );
        if (res.ok) {
          setSaved(false);
          toast.success("Removido dos salvos");
        } else {
          toast.error("Falha ao remover");
        }
      } else {
        const res = await fetch("/api/data/saved", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          body: JSON.stringify({
            platform: detail.kind,
            refId: detail.refId,
            nicheSlug: detail.nicheSlug,
            title: detail.title,
            thumbnail: detail.thumbnail ?? undefined,
            sourceUrl: detail.url,
          }),
        });
        if (res.ok) {
          setSaved(true);
          toast.success("Salvo");
        } else {
          toast.error("Falha ao salvar");
        }
      }
    } finally {
      setSavingNow(false);
    }
  }

  function openInSV() {
    // Sequência Viral: cole link → gera carrossel adaptado
    const url = `https://viral.kaleidos.com.br/?source=${encodeURIComponent(detail!.url)}`;
    window.open(url, "_blank");
  }

  function openInRV() {
    // Reels Viral: cole reel → gera roteiro adaptado
    const url = `https://reels-viral.vercel.app/?source=${encodeURIComponent(detail!.url)}`;
    window.open(url, "_blank");
  }

  function handleTranscribe() {
    // MVP: placeholder. Quando v2 ganhar /api/scrape/ig-transcribe próprio,
    // dispara aqui. Por enquanto link pro RV (que tem pipeline pronto).
    toast.info("Transcrição via Reels Viral");
    setTimeout(() => openInRV(), 400);
  }

  const ageLabel = detail.publishedAt ? timeAgo(detail.publishedAt) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 9, 8, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          background: "var(--color-rdv-cream)",
          border: "1.5px solid var(--color-rdv-ink)",
          boxShadow: "10px 10px 0 0 var(--color-rdv-rec)",
          padding: 0,
          position: "relative",
          maxHeight: "94vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "white",
            border: "1.5px solid var(--color-rdv-line)",
            padding: 6,
            cursor: "pointer",
            zIndex: 1,
          }}
        >
          <X size={14} />
        </button>

        {detail.thumbnail && (
          <div
            style={{
              aspectRatio:
                detail.kind === "instagram"
                  ? detail.isReel
                    ? "9/16"
                    : "4/5"
                  : "16/9",
              maxHeight: 380,
              background: `url(${imgProxy(detail.thumbnail)}) center/cover`,
              borderBottom: "1.5px solid var(--color-rdv-ink)",
            }}
          />
        )}

        <div style={{ padding: "24px 28px 26px" }}>
          <div className="rdv-eyebrow" style={{ marginBottom: 8 }}>
            <span className="rdv-rec-dot" />
            {detail.kind.toUpperCase()}
            {detail.authorName && (
              <span style={{ marginLeft: 8, color: "var(--color-rdv-ink)", fontWeight: 700 }}>
                {detail.authorName}
              </span>
            )}
            {detail.sourceName && (
              <span style={{ marginLeft: 8, color: "var(--color-rdv-ink)", fontWeight: 700 }}>
                {detail.sourceName}
              </span>
            )}
            {ageLabel && (
              <span style={{ marginLeft: 8, color: "var(--color-rdv-muted)" }}>· {ageLabel}</span>
            )}
          </div>

          <h2
            className="rdv-display"
            style={{ fontSize: 24, lineHeight: 1.15, marginBottom: 10 }}
          >
            {detail.title}
          </h2>

          {detail.description && (
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "var(--color-rdv-muted)",
                marginBottom: 16,
                whiteSpace: "pre-line",
              }}
            >
              {detail.description.length > 500
                ? `${detail.description.slice(0, 500)}…`
                : detail.description}
            </p>
          )}

          {/* Métricas */}
          {detail.meta && (
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 18,
                flexWrap: "wrap",
                fontSize: 12,
                color: "var(--color-rdv-muted)",
                fontFamily: "var(--font-geist-mono)",
              }}
            >
              {detail.meta.likes != null && (
                <span>
                  <Heart size={11} style={{ display: "inline", marginRight: 4 }} />
                  <strong style={{ color: "var(--color-rdv-ink)" }}>
                    {fmtNum(detail.meta.likes)}
                  </strong>{" "}
                  likes
                </span>
              )}
              {detail.meta.comments != null && (
                <span>
                  <MessageSquare size={11} style={{ display: "inline", marginRight: 4 }} />
                  <strong style={{ color: "var(--color-rdv-ink)" }}>
                    {fmtNum(detail.meta.comments)}
                  </strong>{" "}
                  comments
                </span>
              )}
              {detail.meta.views != null && detail.meta.views > 0 && (
                <span>
                  <Eye size={11} style={{ display: "inline", marginRight: 4 }} />
                  <strong style={{ color: "var(--color-rdv-ink)" }}>
                    {fmtNum(detail.meta.views)}
                  </strong>{" "}
                  views
                </span>
              )}
              {detail.meta.duration != null && detail.meta.duration > 0 && (
                <span>
                  <strong style={{ color: "var(--color-rdv-ink)" }}>
                    {detail.meta.duration}s
                  </strong>{" "}
                  duração
                </span>
              )}
            </div>
          )}

          {/* Ações */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void handleToggleSave()}
              disabled={savingNow}
              className={saved ? "rdv-btn rdv-btn-rec" : "rdv-btn rdv-btn-ghost"}
              style={{ padding: "11px 14px", fontSize: 11 }}
            >
              {savingNow ? (
                <Loader2 size={11} className="rdv-spin" />
              ) : saved ? (
                <BookmarkCheck size={11} />
              ) : (
                <Bookmark size={11} />
              )}
              {saved ? "Salvo" : "Salvar"}
            </button>

            {/* IG: bridges pro SV/RV */}
            {detail.kind === "instagram" && detail.isReel && (
              <button
                type="button"
                onClick={openInRV}
                className="rdv-btn rdv-btn-ghost"
                style={{ padding: "11px 14px", fontSize: 11 }}
              >
                <Sparkles size={11} /> Adaptar no Reels Viral
              </button>
            )}
            {detail.kind === "instagram" && !detail.isReel && (
              <button
                type="button"
                onClick={openInSV}
                className="rdv-btn rdv-btn-ghost"
                style={{ padding: "11px 14px", fontSize: 11 }}
              >
                <Wand2 size={11} /> Recriar no Sequência Viral
              </button>
            )}

            {/* IG carousel: transcrição. YT também tem transcrição automática. */}
            {(detail.kind === "instagram" && !detail.isReel) || detail.kind === "youtube" ? (
              <button
                type="button"
                onClick={handleTranscribe}
                className="rdv-btn rdv-btn-ghost"
                style={{ padding: "11px 14px", fontSize: 11 }}
              >
                <FileText size={11} /> Transcrever
              </button>
            ) : null}

            {/* Link externo sempre */}
            <a
              href={detail.url}
              target="_blank"
              rel="noreferrer"
              className="rdv-btn rdv-btn-ghost"
              style={{ padding: "11px 14px", fontSize: 11, textDecoration: "none" }}
            >
              <ExternalLink size={11} />
              {detail.kind === "youtube"
                ? "Ver no YouTube"
                : detail.kind === "instagram"
                  ? "Ver no Instagram"
                  : "Abrir notícia"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
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
