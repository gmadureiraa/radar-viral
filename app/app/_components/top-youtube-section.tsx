"use client";

/**
 * Seção do dashboard: Top 3 YouTube do dia.
 *
 * Schema da tabela `videos` na v1 só guarda metadados RSS (sem view_count
 * porque o feed RSS não publica esse campo). Por isso ordenamos por
 * `published_at DESC` numa janela de 48h — proxy de "vídeo novo no
 * radar" = "em alta agora".
 *
 * Bookmark + link → YouTube.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Loader2,
  Play,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { getJwtToken } from "@/lib/auth-client";
import type { VideoRow } from "@/app/api/data/videos/route";

interface Props {
  nicheId: string;
  isPaid: boolean;
  /** Quantos vídeos mostrar (default 3) */
  limit?: number;
}

export function TopYouTubeSection({ nicheId, isPaid, limit = 3 }: Props) {
  const [items, setItems] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const [vidsRes, savedRes] = await Promise.all([
          fetch(
            `/api/data/videos?niche=${encodeURIComponent(nicheId)}&hours=48&limit=${limit}`,
            { headers },
          ),
          fetch("/api/data/saved?platform=youtube", { headers }),
        ]);
        if (!vidsRes.ok) {
          if (!cancel) setError(`HTTP ${vidsRes.status}`);
          return;
        }
        const data = (await vidsRes.json()) as { videos: VideoRow[] };
        if (!cancel) setItems(data.videos ?? []);
        if (savedRes.ok) {
          const sd = (await savedRes.json()) as { items: Array<{ ref_id: string }> };
          if (!cancel) setSaved(new Set((sd.items ?? []).map((i) => i.ref_id)));
        }
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [nicheId, limit]);

  const handleSave = useCallback(
    async (video: VideoRow) => {
      const refId = video.video_id;
      const isSaved = saved.has(refId);
      try {
        const jwt = await getJwtToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
        if (isSaved) {
          const res = await fetch(
            `/api/data/saved?platform=youtube&refId=${encodeURIComponent(refId)}`,
            { method: "DELETE", headers },
          );
          if (!res.ok) throw new Error("Falha ao remover");
          setSaved((prev) => {
            const next = new Set(prev);
            next.delete(refId);
            return next;
          });
          toast.success("Removido dos salvos");
        } else {
          const res = await fetch("/api/data/saved", {
            method: "POST",
            headers,
            body: JSON.stringify({
              platform: "youtube",
              refId,
              nicheSlug: nicheId,
              title: video.title,
              note: video.channel_name,
              sourceUrl: video.link,
              thumbnail: video.thumbnail_url,
            }),
          });
          if (!res.ok) throw new Error("Falha ao salvar");
          setSaved((prev) => new Set(prev).add(refId));
          toast.success("Vídeo salvo");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [saved, nicheId],
  );

  return (
    <section style={{ marginBottom: 36 }}>
      <SectionHeader
        eyebrow="YOUTUBE EM ALTA"
        title={`Top ${limit} YouTube do dia`}
        subtitle={
          isPaid
            ? `Top ${limit} dos canais que você acompanha`
            : `Curadoria global · top ${limit} últimas 48h`
        }
        icon={<Youtube size={16} />}
      />
      {loading && !items.length ? (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" />
        </div>
      ) : error ? (
        <EmptyCard msg={`Erro ao carregar YT (${error}).`} />
      ) : !items.length ? (
        <EmptyCard
          msg={
            isPaid
              ? "Sem vídeos novos nas últimas 48h. Cheque seus canais."
              : "Sem fontes YT na curadoria desse nicho ainda. Adicione canais."
          }
          ctaHref="/app/settings"
          ctaLabel="Adicionar canais →"
        />
      ) : (
        <YouTubeCarousel>
          {items.map((v) => (
            <YouTubeCard
              key={v.video_id}
              video={v}
              saved={saved.has(v.video_id)}
              onToggleSave={() => void handleSave(v)}
            />
          ))}
        </YouTubeCarousel>
      )}
    </section>
  );
}

/**
 * Carrossel horizontal com drag/scroll. Cada slide ocupa ~320px e tem
 * scroll-snap pra alinhar bonito ao soltar. Suporta:
 *  - drag com mouse (botão esquerdo): captura coords, atualiza scrollLeft
 *  - touch nativo do browser (sem JS extra)
 *  - shadow nas bordas que indica "tem mais"
 */
function YouTubeCarousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const dragState = useRef<{ isDown: boolean; startX: number; scrollLeft: number; moved: boolean }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  const updateFades = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 8);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateFades();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => updateFades();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [updateFades]);

  function onMouseDown(e: React.MouseEvent) {
    const el = trackRef.current;
    if (!el) return;
    dragState.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    el.style.cursor = "grabbing";
    el.style.scrollSnapType = "none";
  }

  function onMouseLeave() {
    const el = trackRef.current;
    if (!el) return;
    dragState.current.isDown = false;
    el.style.cursor = "grab";
    el.style.scrollSnapType = "x mandatory";
  }

  function onMouseUp() {
    const el = trackRef.current;
    if (!el) return;
    dragState.current.isDown = false;
    el.style.cursor = "grab";
    el.style.scrollSnapType = "x mandatory";
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragState.current.isDown) return;
    const el = trackRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.2;
    if (Math.abs(walk) > 4) dragState.current.moved = true;
    el.scrollLeft = dragState.current.scrollLeft - walk;
  }

  // Bloqueia clicks se houve drag (evita abrir vídeo ao soltar do drag).
  function onClickCapture(e: React.MouseEvent) {
    if (dragState.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragState.current.moved = false;
    }
  }

  function scrollByPage(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        onClickCapture={onClickCapture}
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(280px, 320px)",
          gap: 12,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          paddingBottom: 8,
          cursor: "grab",
          userSelect: "none",
          // Esconde scrollbar (Webkit) — drag é a interação primária
          scrollbarWidth: "thin",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {Array.isArray(children)
          ? children.map((c, i) => (
              <div key={i} style={{ scrollSnapAlign: "start" }}>
                {c}
              </div>
            ))
          : children}
      </div>

      {/* Setas de navegação (desktop) */}
      {showLeftFade && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Anterior"
          style={carouselArrowStyle("left")}
        >
          ‹
        </button>
      )}
      {showRightFade && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Próximo"
          style={carouselArrowStyle("right")}
        >
          ›
        </button>
      )}

      {/* Fade gradients indicando "tem mais" */}
      {showLeftFade && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 8,
            left: 0,
            width: 36,
            background:
              "linear-gradient(to right, var(--color-rdv-paper) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      )}
      {showRightFade && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 8,
            right: 0,
            width: 36,
            background:
              "linear-gradient(to left, var(--color-rdv-paper) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

function carouselArrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(50% - 4px)",
    [side]: 4,
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--color-rdv-ink)",
    color: "white",
    border: "1.5px solid var(--color-rdv-ink)",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    zIndex: 2,
    boxShadow: "2px 2px 0 0 var(--color-rdv-rec)",
  };
}

function YouTubeCard({
  video,
  saved,
  onToggleSave,
}: {
  video: VideoRow;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const ago = relativeTime(video.published_at);
  return (
    <div
      className="rdv-card"
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <a
        href={video.link}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          aspectRatio: "16/9",
          background: "var(--color-rdv-paper)",
          position: "relative",
          borderBottom: "1.5px solid var(--color-rdv-ink)",
        }}
      >
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255, 61, 46, 0.92)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
            }}
          >
            <Play size={20} fill="white" stroke="white" />
          </div>
        </div>
      </a>
      <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
        <h3
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {video.title}
        </h3>
        <div
          className="rdv-mono"
          style={{
            fontSize: 10,
            color: "var(--color-rdv-muted)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          <span>{video.channel_name}</span>
          {ago && <span>· {ago}</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <a
            href={video.link}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <ExternalLink size={10} /> YouTube
          </a>
          <button
            type="button"
            onClick={onToggleSave}
            className="rdv-btn rdv-btn-ghost"
            style={{
              padding: "5px 10px",
              fontSize: 9,
              color: saved ? "var(--color-rdv-rec)" : undefined,
              borderColor: saved ? "var(--color-rdv-rec)" : undefined,
            }}
          >
            {saved ? <BookmarkCheck size={10} /> : <Bookmark size={10} />}{" "}
            {saved ? "Salvo" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  icon,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> {eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          className="rdv-display"
          style={{
            fontSize: 26,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "var(--color-rdv-rec)" }}>{icon}</span>
          {title}
        </div>
        {subtitle && (
          <span
            className="rdv-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyCard({
  msg,
  ctaHref,
  ctaLabel,
}: {
  msg: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      className="rdv-card"
      style={{
        padding: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <p style={{ fontSize: 13, color: "var(--color-rdv-muted)" }}>{msg}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 12px", fontSize: 10 }}
        >
          {ctaLabel}
          <ArrowRight size={10} />
        </Link>
      )}
    </div>
  );
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return "agora";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  return `${d}d atrás`;
}
