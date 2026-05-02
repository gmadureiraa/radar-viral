"use client";

/**
 * Seção do dashboard: Notícias em alta hoje.
 *
 * Lê /api/data/news com janela curta (48h) e mostra top N artigos.
 * Bookmark + link direto pra fonte. Empty state CTA pro settings.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Loader2,
  Newspaper,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { getJwtToken } from "@/lib/auth-client";
import type { NewsArticleRow } from "@/app/api/data/news/route";

interface Props {
  nicheId: string;
  isPaid: boolean;
}

export function TopNewsSection({ nicheId, isPaid }: Props) {
  const [items, setItems] = useState<NewsArticleRow[]>([]);
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
        const [newsRes, savedRes] = await Promise.all([
          fetch(
            `/api/data/news?niche=${encodeURIComponent(nicheId)}&hours=48&limit=8`,
            { headers },
          ),
          fetch("/api/data/saved?platform=news", { headers }),
        ]);
        if (!newsRes.ok) {
          if (!cancel) setError(`HTTP ${newsRes.status}`);
          return;
        }
        const data = (await newsRes.json()) as { articles: NewsArticleRow[] };
        if (!cancel) setItems(data.articles ?? []);
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
    async (article: NewsArticleRow) => {
      const refId = article.link;
      const isSaved = saved.has(refId);
      try {
        const jwt = await getJwtToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
        if (isSaved) {
          const res = await fetch(
            `/api/data/saved?platform=news&refId=${encodeURIComponent(refId)}`,
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
              platform: "news",
              refId,
              nicheSlug: nicheId,
              title: article.title,
              note: article.source_name ?? undefined,
              sourceUrl: article.link,
              thumbnail: article.thumbnail ?? undefined,
            }),
          });
          if (!res.ok) throw new Error("Falha ao salvar");
          setSaved((prev) => new Set(prev).add(refId));
          toast.success("Notícia salva");
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
        eyebrow="NOTÍCIAS EM ALTA"
        title="Notícias em alta hoje"
        subtitle={
          isPaid
            ? "Das fontes RSS que você acompanha"
            : "Curadoria global · últimas 48h"
        }
        icon={<Newspaper size={16} />}
      />
      {loading && !items.length ? (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" />
        </div>
      ) : error ? (
        <EmptyCard
          msg={`Erro ao carregar notícias (${error}).`}
        />
      ) : !items.length ? (
        <EmptyCard
          msg={
            isPaid
              ? "Sem notícias nas últimas 48h. Adicione mais fontes RSS."
              : "Sem notícias nas últimas 48h. Adicione fontes RSS pra ter feed próprio."
          }
          ctaHref="/app/settings"
          ctaLabel="Adicionar fontes →"
        />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((a) => (
            <NewsCard
              key={a.link}
              article={a}
              saved={saved.has(a.link)}
              onToggleSave={() => void handleSave(a)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NewsCard({
  article,
  saved,
  onToggleSave,
}: {
  article: NewsArticleRow;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const ago = relativeTime(article.pub_date);
  return (
    <div
      className="rdv-card"
      style={{
        padding: "12px 16px",
        display: "flex",
        gap: 14,
        alignItems: "center",
      }}
    >
      {article.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.thumbnail}
          alt=""
          loading="lazy"
          style={{
            width: 64,
            height: 64,
            objectFit: "cover",
            flexShrink: 0,
            background: "var(--color-rdv-paper)",
            border: "1px solid var(--color-rdv-line)",
          }}
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            background: article.source_color ?? "var(--color-rdv-paper)",
            border: "1px solid var(--color-rdv-line)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "var(--font-geist-mono)",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {(article.source_name ?? "?").slice(0, 2).toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.25,
            marginBottom: 4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {article.title}
        </h3>
        <div
          className="rdv-mono"
          style={{
            fontSize: 10,
            color: "var(--color-rdv-muted)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700 }}>
            {article.source_name ?? "Fonte"}
          </span>
          {ago && <span>· {ago}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 10px", fontSize: 9 }}
          aria-label="Abrir notícia"
        >
          <ExternalLink size={11} />
        </a>
        <button
          type="button"
          onClick={onToggleSave}
          className="rdv-btn rdv-btn-ghost"
          style={{
            padding: "6px 10px",
            fontSize: 9,
            color: saved ? "var(--color-rdv-rec)" : undefined,
            borderColor: saved ? "var(--color-rdv-rec)" : undefined,
          }}
          aria-label={saved ? "Remover dos salvos" : "Salvar notícia"}
        >
          {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
        </button>
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
