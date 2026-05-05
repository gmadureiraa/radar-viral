"use client";

/**
 * Seção do dashboard: Top 3 Instagram do dia.
 *
 * Lê /api/data/instagram/posts?sort=top&hours=48&limit=3.
 * Bookmark + bridges Carrossel SV / Reel RV.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Heart,
  Instagram,
  Loader2,
  MessageSquare,
  Layers,
  Film,
  ArrowRight,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { getJwtToken } from "@/lib/auth-client";
import { imgProxy } from "@/lib/img-proxy";
import type { InstagramPostRow } from "@/app/api/data/instagram/posts/route";

interface Props {
  nicheId: string;
  isPaid: boolean;
}

export function TopInstagramSection({ nicheId, isPaid }: Props) {
  const [items, setItems] = useState<InstagramPostRow[]>([]);
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
        const [postsRes, savedRes] = await Promise.all([
          fetch(
            `/api/data/instagram/posts?niche=${encodeURIComponent(nicheId)}&sort=top&hours=48&limit=3`,
            { headers },
          ),
          fetch("/api/data/saved?platform=instagram", { headers }),
        ]);
        if (!postsRes.ok) {
          if (!cancel) setError(`HTTP ${postsRes.status}`);
          return;
        }
        const data = (await postsRes.json()) as { posts: InstagramPostRow[] };
        if (!cancel) setItems(data.posts ?? []);
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
  }, [nicheId]);

  const handleSave = useCallback(
    async (post: InstagramPostRow) => {
      const refId = post.shortcode;
      const isSaved = saved.has(refId);
      try {
        const jwt = await getJwtToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
        if (isSaved) {
          const res = await fetch(
            `/api/data/saved?platform=instagram&refId=${encodeURIComponent(refId)}`,
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
              platform: "instagram",
              refId,
              nicheSlug: nicheId,
              title: post.caption?.slice(0, 120) ?? `@${post.account_handle}`,
              note: `@${post.account_handle}`,
              sourceUrl: `https://www.instagram.com/p/${post.shortcode}/`,
              thumbnail: post.display_url ?? undefined,
            }),
          });
          if (!res.ok) throw new Error("Falha ao salvar");
          setSaved((prev) => new Set(prev).add(refId));
          toast.success("Post salvo");
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
        eyebrow="INSTAGRAM EM ALTA"
        title="Top 3 Instagram do dia"
        subtitle={
          isPaid
            ? "Top 3 dos perfis que você acompanha"
            : "Curadoria global · top 3 últimas 48h"
        }
        icon={<Instagram size={16} />}
      />
      {loading && !items.length ? (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" />
        </div>
      ) : error ? (
        <EmptyCard msg={`Erro ao carregar IG (${error}).`} />
      ) : !items.length ? (
        <EmptyCard
          msg={
            isPaid
              ? "Sem posts IG nas últimas 48h. Cheque suas fontes."
              : "Sem fontes IG na curadoria desse nicho ainda. Adicione handles."
          }
          ctaHref="/app/settings"
          ctaLabel="Adicionar handles →"
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((p) => (
            <InstagramCard
              key={p.shortcode}
              post={p}
              saved={saved.has(p.shortcode)}
              onToggleSave={() => void handleSave(p)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InstagramCard({
  post,
  saved,
  onToggleSave,
}: {
  post: InstagramPostRow;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const caption = (post.caption ?? "").trim();
  const truncated =
    caption.length > 80 ? caption.slice(0, 80).trimEnd() + "…" : caption;
  const igUrl = `https://www.instagram.com/p/${post.shortcode}/`;
  // Fallback chain: display_url → 1º child_url. Filtra null.
  const previewUrl =
    post.display_url ||
    post.child_urls?.find((u): u is string => typeof u === "string" && Boolean(u)) ||
    null;
  const isVideo = post.type === "Video" || Boolean(post.video_url);
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
        href={igUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          aspectRatio: "1",
          background: "var(--color-rdv-paper)",
          position: "relative",
          borderBottom: "1.5px solid var(--color-rdv-ink)",
          overflow: "hidden",
        }}
      >
        {previewUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgProxy(previewUrl)}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <CompactPlaceholder
            handle={post.account_handle}
            caption={post.caption}
            isVideo={isVideo}
          />
        )}
      </a>
      <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
        <div
          className="rdv-mono"
          style={{
            fontSize: 10,
            color: "var(--color-rdv-muted)",
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          @{post.account_handle}
        </div>
        {truncated && (
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.4,
              color: "var(--color-rdv-ink)",
            }}
          >
            {truncated}
          </p>
        )}
        <div
          className="rdv-mono"
          style={{
            display: "flex",
            gap: 12,
            fontSize: 10,
            color: "var(--color-rdv-muted)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Heart size={11} /> {formatCount(post.likes)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MessageSquare size={11} /> {formatCount(post.comments)}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <a
            href={igUrl}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <ExternalLink size={10} /> Abrir
          </a>
          <a
            href={svBridgeFromIg(post)}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <Layers size={10} /> Carrossel SV
          </a>
          <a
            href={rvBridgeFromIg(post)}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <Film size={10} /> Reel RV
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
            {saved ? <BookmarkCheck size={10} /> : <Bookmark size={10} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function svBridgeFromIg(post: InstagramPostRow): string {
  const idea = [
    `Tema: post viral de @${post.account_handle}`,
    post.caption ? `Caption original: ${post.caption.slice(0, 240)}` : "",
    "Crie um carrossel de 6-8 slides em PT-BR explorando esse ângulo, linguagem simples e direta.",
  ]
    .filter(Boolean)
    .join("\n");
  return `https://viral.kaleidos.com.br/app/create/new?idea=${encodeURIComponent(idea)}`;
}

function rvBridgeFromIg(post: InstagramPostRow): string {
  return `https://reels-viral.vercel.app/?url=${encodeURIComponent(
    `https://www.instagram.com/p/${post.shortcode}/`,
  )}`;
}

/**
 * Placeholder compacto pra grid do dashboard quando preview do IG falha.
 * Mesma vibe da PostPlaceholder do /app/instagram mas otimizado pra
 * tile menor (aspect-ratio 1:1).
 */
function CompactPlaceholder({
  handle,
  caption,
  isVideo,
}: {
  handle: string;
  caption: string | null;
  isVideo: boolean;
}) {
  const snippet = (caption ?? "").trim().slice(0, 60);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "repeating-linear-gradient(135deg, var(--color-rdv-paper) 0 8px, var(--color-rdv-cream) 8px 14px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 12px",
        textAlign: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--color-rdv-ink)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isVideo ? <Video size={18} /> : <Instagram size={18} />}
      </div>
      <div
        className="rdv-mono"
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "var(--color-rdv-ink)",
          letterSpacing: "0.04em",
          wordBreak: "break-word",
        }}
      >
        @{handle}
      </div>
      {snippet && (
        <p
          style={{
            fontSize: 9.5,
            color: "var(--color-rdv-muted)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {snippet}
        </p>
      )}
    </div>
  );
}

function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
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
