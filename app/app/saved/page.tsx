"use client";

/**
 * /app/saved — Bookmarks cross-platform do user.
 */

import { useEffect, useMemo, useState } from "react";
import { BookmarkCheck, RefreshCw, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getJwtToken } from "@/lib/auth-client";
import type { SavedItemRow } from "@/app/api/data/saved/route";

type Platform = "all" | "instagram" | "youtube" | "news" | "newsletter" | "idea";

export default function SavedPage() {
  const [items, setItems] = useState<SavedItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Platform>("all");

  const refresh = async () => {
    setLoading(true);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/data/saved`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) {
        toast.error(`Erro ${res.status}`);
        return;
      }
      const data = (await res.json()) as { items: SavedItemRow[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.platform === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.platform] = (c[i.platform] ?? 0) + 1;
    return c;
  }, [items]);

  async function handleRemove(item: SavedItemRow) {
    const jwt = await getJwtToken();
    const res = await fetch(`/api/data/saved?platform=${item.platform}&refId=${encodeURIComponent(item.ref_id)}`, {
      method: "DELETE",
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
    });
    if (!res.ok) {
      toast.error("Falha ao remover");
      return;
    }
    setItems((prev) => prev.filter((p) => !(p.platform === item.platform && p.ref_id === item.ref_id)));
    toast.success("Removido");
  }

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> SALVOS
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
          Tua <em>biblioteca</em>.
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

      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {(["all", "instagram", "youtube", "news", "newsletter", "idea"] as Platform[]).map((p) => {
          const active = p === filter;
          const label =
            p === "all" ? "Todos" : p === "newsletter" ? "Newsletters" : p === "idea" ? "Ideias" : p[0].toUpperCase() + p.slice(1);
          const count = counts[p] ?? 0;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setFilter(p)}
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
              {label} <span style={{ opacity: 0.7, fontWeight: 500 }}>· {count}</span>
            </button>
          );
        })}
      </div>

      {loading && items.length === 0 && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center" }}>
          <BookmarkCheck size={28} style={{ margin: "0 auto 12px", color: "var(--color-rdv-muted)" }} />
          <p style={{ fontSize: 14, color: "var(--color-rdv-muted)" }}>
            Nada salvo ainda. Bookmarks viram na biblioteca pra revisar depois.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((item) => (
            <SavedRow key={item.id} item={item} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </main>
  );
}

function SavedRow({ item, onRemove }: { item: SavedItemRow; onRemove: (i: SavedItemRow) => void }) {
  return (
    <div className="rdv-card" style={{ padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
      {item.thumbnail && (
        <div
          style={{
            flexShrink: 0,
            width: 64,
            height: 64,
            background: `url(${item.thumbnail}) center/cover`,
            border: "1px solid var(--color-rdv-line)",
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "2px 6px",
            background: "var(--color-rdv-soft)",
            display: "inline-block",
            marginBottom: 4,
          }}
        >
          {item.platform}
        </span>
        <h3 style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35, marginBottom: 2 }}>
          {item.title}
        </h3>
        {item.note && (
          <p style={{ fontSize: 11, color: "var(--color-rdv-muted)", lineHeight: 1.4 }}>{item.note}</p>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "6px 10px", fontSize: 9 }}
          >
            <ExternalLink size={10} />
          </a>
        )}
        <button
          type="button"
          onClick={() => onRemove(item)}
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 10px", fontSize: 9, color: "var(--color-rdv-rec)" }}
          aria-label="Remover"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
