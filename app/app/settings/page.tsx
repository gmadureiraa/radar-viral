"use client";

/**
 * /app/settings — gerenciar nicho ativo, MINHAS FONTES (CRUD via /api/sources)
 * e visualizar catálogo curado.
 *
 * Pro user: tracked_sources com user_id existem, dropdown de ações por fonte.
 * Free user: explica que precisa Pro pra ter cron individual + mostra catálogo
 * curado como referência (mesmas fontes que entram automaticamente ao pagar).
 */

import { useEffect, useState } from "react";
import {
  Instagram,
  Youtube,
  Newspaper,
  Mail,
  Lock,
  Sparkles,
  Check,
  Plus,
  Loader2,
  X,
  Pause,
  Play,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useActiveNiche } from "@/lib/niche-context";
import { getCuratedSources } from "@/lib/sources-curated";
import { useNeonSession, getJwtToken } from "@/lib/auth-client";
import { SourceActionsMenu } from "@/components/source-actions-menu";
import { NichePillBar } from "@/app/app/_components/niche-pill-bar";
import type { UserSourceRow } from "@/app/api/sources/route";

type Category = "ig" | "youtube" | "news" | "newsletter";

const CATEGORY_TO_PLATFORM: Record<Category, string> = {
  ig: "instagram",
  youtube: "youtube",
  news: "rss",
  newsletter: "newsletter",
};

const PLATFORM_TO_CATEGORY: Record<string, Category> = {
  instagram: "ig",
  youtube: "youtube",
  rss: "news",
  newsletter: "newsletter",
};

export default function SettingsPage() {
  const session = useNeonSession();
  const { active } = useActiveNiche();
  const [tab, setTab] = useState<Category>("ig");
  const [mySources, setMySources] = useState<UserSourceRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [editing, setEditing] = useState<UserSourceRow | null>(null);
  const [adding, setAdding] = useState(false);

  const sources = getCuratedSources(active.id);
  const counts = sources
    ? {
        ig: sources.igHandles.length,
        youtube: sources.youtubeChannels.length,
        news: sources.newsRss.length,
        newsletter: sources.newsletterSubscribe.length,
      }
    : { ig: 0, youtube: 0, news: 0, newsletter: 0 };

  // Carrega fontes individuais do user
  const refreshMine = async () => {
    if (!session.data?.user) return;
    setLoadingMine(true);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/sources?niche=${active.id}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as { sources: UserSourceRow[] };
        setMySources(data.sources ?? []);
      } else if (res.status === 401) {
        // Token expirou — silencioso, sessão vai redirecionar pra landing
      } else {
        // Outras falhas dão feedback no toast
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? `Falha ao carregar fontes (${res.status})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    void refreshMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data?.user?.id, active.id]);

  const myByCategory = (cat: Category) =>
    mySources.filter((s) => s.platform === CATEGORY_TO_PLATFORM[cat]);

  const handleToggleActive = async (s: UserSourceRow) => {
    try {
      const jwt = await getJwtToken();
      const res = await fetch("/api/sources", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ id: s.id, active: !s.active }),
      });
      if (!res.ok) throw new Error("Falha");
      toast.success(s.active ? "Fonte pausada" : "Fonte ativada");
      void refreshMine();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleDelete = async (s: UserSourceRow) => {
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/sources?id=${s.id}`, {
        method: "DELETE",
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast.success("Fonte removida");
      void refreshMine();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const hasIndividualCron = mySources.length > 0;

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> CONFIGURAÇÕES
      </div>
      <h1
        className="rdv-display"
        style={{
          fontSize: "clamp(32px, 4vw, 48px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          marginBottom: 6,
        }}
      >
        Suas <em>fontes</em>.
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-rdv-muted)",
          marginBottom: 18,
        }}
      >
        Escolha o nicho e veja quais fontes alimentam seu brief diário.
      </p>

      {/* Niche switcher: pills compactas (consistente com dashboard) */}
      <NichePillBar />

      {/* Free notice — versão simplificada, sem termo técnico */}
      {!hasIndividualCron && (
        <section style={{ marginBottom: 28 }}>
          <div
            className="rdv-card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderColor: "var(--color-rdv-amber)",
              boxShadow: "4px 4px 0 0 var(--color-rdv-amber)",
              flexWrap: "wrap",
            }}
          >
            <Lock
              size={18}
              style={{
                color: "var(--color-rdv-amber)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div
                style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}
              >
                Plano Free · catálogo compartilhado
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--color-rdv-muted)",
                  lineHeight: 1.5,
                }}
              >
                Você vê o brief gerado a partir das fontes globais abaixo.
                No Pro você customiza fontes próprias e tem cron individual.
              </p>
            </div>
            <Link
              href="/app/precos"
              className="rdv-btn rdv-btn-rec"
              style={{ padding: "8px 14px", fontSize: 10, whiteSpace: "nowrap" }}
            >
              <Sparkles size={11} /> Ver planos
            </Link>
          </div>
        </section>
      )}

      {/* MINHAS FONTES — Pro user */}
      {hasIndividualCron && (
        <section style={{ marginBottom: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div className="rdv-eyebrow">
              <span className="rdv-rec-dot" /> MINHAS FONTES ·{" "}
              {active.label.toUpperCase()}
            </div>
            <span
              className="rdv-mono"
              style={{
                fontSize: 10,
                color: "var(--color-rdv-muted)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {mySources.length} cadastrada{mySources.length === 1 ? "" : "s"}
              {" · "}
              {mySources.filter((s) => s.active).length} ativa
              {mySources.filter((s) => s.active).length === 1 ? "" : "s"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <CategoryChips
              tab={tab}
              onChange={setTab}
              counts={{
                ig: myByCategory("ig").length,
                youtube: myByCategory("youtube").length,
                news: myByCategory("news").length,
                newsletter: myByCategory("newsletter").length,
              }}
            />
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rdv-btn rdv-btn-rec"
              style={{ padding: "8px 14px", fontSize: 11, marginLeft: "auto" }}
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>

          {loadingMine && mySources.length === 0 && (
            <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
              <Loader2 size={20} className="rdv-spin" />
            </div>
          )}

          <MyCategoryGrid
            tab={tab}
            sources={myByCategory(tab)}
            onToggle={handleToggleActive}
            onEdit={(s) => setEditing(s)}
            onDelete={handleDelete}
          />
        </section>
      )}

      {/* Catálogo de fontes (sempre visível) */}
      {sources && (
        <section>
          <div className="rdv-eyebrow" style={{ marginBottom: 10 }}>
            CATÁLOGO CURADO · {active.label.toUpperCase()}
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-rdv-muted)",
              marginBottom: 16,
              maxWidth: 720,
            }}
          >
            {hasIndividualCron
              ? "Fontes pré-cadastradas pela curadoria Kaleidos. Use a aba “Minhas fontes” acima pra ativar/desativar."
              : "Estas são as fontes que entram automaticamente quando você assinar o Pro."}
          </p>

          <CategoryChips
            tab={tab}
            onChange={setTab}
            counts={counts}
          />

          <div style={{ marginTop: 16 }}>
            {tab === "ig" && (
              <CatalogGrid
                items={sources.igHandles.map((h) => ({
                  key: h.handle,
                  title: `@${h.handle}`,
                  subtitle: h.label,
                  detail: h.followers ? `${h.followers} seguidores` : undefined,
                  href: `https://instagram.com/${h.handle}`,
                  icon: <Instagram size={14} />,
                }))}
              />
            )}
            {tab === "youtube" && (
              <CatalogGrid
                items={sources.youtubeChannels.map((c) => ({
                  key: c.handle,
                  title: c.handle,
                  subtitle: c.label,
                  href: `https://youtube.com/${c.handle}`,
                  icon: <Youtube size={14} />,
                }))}
              />
            )}
            {tab === "news" && (
              <CatalogGrid
                items={sources.newsRss.map((r) => ({
                  key: r.url,
                  title: r.name,
                  subtitle: r.url,
                  detail: r.lang === "pt" ? "🇧🇷 PT" : "🇺🇸 EN",
                  href: r.url,
                  icon: <Newspaper size={14} />,
                }))}
              />
            )}
            {tab === "newsletter" && (
              <CatalogGrid
                items={sources.newsletterSubscribe.map((nl) => ({
                  key: nl.subscribeUrl,
                  title: nl.name,
                  subtitle: nl.sender,
                  detail: "Cadastre seu Gmail trackado",
                  href: nl.subscribeUrl,
                  icon: <Mail size={14} />,
                  cta: "Assinar →",
                }))}
              />
            )}
          </div>
        </section>
      )}

      {/* Modais */}
      {editing && (
        <EditSourceModal
          source={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refreshMine();
          }}
        />
      )}
      {adding && (
        <AddSourceModal
          niche={active.id}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void refreshMine();
          }}
        />
      )}
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function CategoryChips({
  tab,
  onChange,
  counts,
}: {
  tab: Category;
  onChange: (c: Category) => void;
  counts: { ig: number; youtube: number; news: number; newsletter: number };
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(["ig", "youtube", "news", "newsletter"] as Category[]).map((c) => {
        const isActive = c === tab;
        const label =
          c === "ig"
            ? "Instagram"
            : c === "youtube"
              ? "YouTube"
              : c === "news"
                ? "RSS Notícias"
                : "Newsletters";
        const Icon =
          c === "ig"
            ? Instagram
            : c === "youtube"
              ? Youtube
              : c === "news"
                ? Newspaper
                : Mail;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              padding: "8px 12px",
              border: "1.5px solid var(--color-rdv-ink)",
              background: isActive ? "var(--color-rdv-ink)" : "white",
              color: isActive ? "white" : "var(--color-rdv-ink)",
              cursor: "pointer",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              boxShadow: isActive ? "2px 2px 0 0 var(--color-rdv-rec)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon size={11} /> {label}
            <span style={{ opacity: 0.7, fontWeight: 500 }}>
              · {counts[c]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MyCategoryGrid({
  tab,
  sources,
  onToggle,
  onEdit,
  onDelete,
}: {
  tab: Category;
  sources: UserSourceRow[];
  onToggle: (s: UserSourceRow) => void;
  onEdit: (s: UserSourceRow) => void;
  onDelete: (s: UserSourceRow) => void;
}) {
  const Icon =
    tab === "ig"
      ? Instagram
      : tab === "youtube"
        ? Youtube
        : tab === "news"
          ? Newspaper
          : Mail;

  if (sources.length === 0) {
    return (
      <div
        className="rdv-card"
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--color-rdv-muted)",
          fontSize: 13,
        }}
      >
        Nenhuma fonte cadastrada nessa categoria. Clique em{" "}
        <strong>Adicionar</strong> pra começar.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      }}
    >
      {sources.map((s) => (
        <div
          key={s.id}
          className="rdv-card"
          style={{
            padding: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: s.active ? 1 : 0.55,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              background: s.active
                ? "var(--color-rdv-ink)"
                : "var(--color-rdv-line)",
              color: "var(--color-rdv-paper)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={13} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.handle}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-rdv-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.display_name ?? "—"}
            </div>
            {!s.active && (
              <span
                className="rdv-mono"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-rdv-rec)",
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Pause size={9} /> Pausada
              </span>
            )}
            {s.active && (
              <span
                className="rdv-mono"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#1a8a3a",
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Play size={9} /> Ativa
              </span>
            )}
          </div>
          <SourceActionsMenu
            active={s.active}
            onTogglePause={() => onToggle(s)}
            onEdit={() => onEdit(s)}
            onDelete={() => onDelete(s)}
          />
        </div>
      ))}
    </div>
  );
}

interface CatalogItem {
  key: string;
  title: string;
  subtitle?: string;
  detail?: string;
  href: string;
  icon: React.ReactNode;
  cta?: string;
}

function CatalogGrid({ items }: { items: CatalogItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      }}
    >
      {items.map((it) => (
        <a
          key={it.key}
          href={it.href}
          target="_blank"
          rel="noreferrer"
          className="rdv-card"
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              background: "var(--color-rdv-ink)",
              color: "var(--color-rdv-paper)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {it.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{it.title}</div>
            {it.subtitle && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-rdv-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {it.subtitle}
              </div>
            )}
            {it.detail && (
              <div
                className="rdv-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-rdv-muted)",
                  marginTop: 4,
                  fontWeight: 700,
                }}
              >
                {it.detail}
              </div>
            )}
          </div>
          <span
            className="rdv-mono"
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--color-rdv-rec)",
              flexShrink: 0,
            }}
          >
            {it.cta ?? "Ver →"}
          </span>
        </a>
      ))}
    </div>
  );
}

// ─── Modais ────────────────────────────────────────────────────────────

function EditSourceModal({
  source,
  onClose,
  onSaved,
}: {
  source: UserSourceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [handle, setHandle] = useState(source.handle);
  const [displayName, setDisplayName] = useState(source.display_name ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const jwt = await getJwtToken();
      const res = await fetch("/api/sources", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          id: source.id,
          handle: handle.trim(),
          displayName: displayName.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success("Fonte atualizada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Editar fonte" onClose={onClose}>
      <FieldRow label="Handle">
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@usuario"
          style={inputStyle}
        />
      </FieldRow>
      <FieldRow label="Nome amigável">
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Ex: Alex Hormozi · Business"
          style={inputStyle}
        />
      </FieldRow>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button
          type="button"
          onClick={onClose}
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !handle.trim()}
          className="rdv-btn rdv-btn-rec"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          {saving ? <Loader2 size={11} className="rdv-spin" /> : <Check size={11} />}
          Salvar
        </button>
      </div>
    </ModalShell>
  );
}

function AddSourceModal({
  niche,
  onClose,
  onSaved,
}: {
  niche: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [platform, setPlatform] = useState("instagram");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!handle.trim()) {
      toast.error("Handle é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const jwt = await getJwtToken();
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          platform,
          niche,
          handle: handle.trim(),
          displayName: displayName.trim() || null,
          active: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success("Fonte adicionada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Adicionar fonte" onClose={onClose}>
      <FieldRow label="Plataforma">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={inputStyle}
        >
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="rss">RSS Notícias</option>
          <option value="newsletter">Newsletter</option>
        </select>
      </FieldRow>
      <FieldRow label="Handle / URL">
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={
            platform === "instagram"
              ? "username (sem @)"
              : platform === "youtube"
                ? "@channelName"
                : platform === "rss"
                  ? "https://site.com/feed"
                  : "newsletter@dominio.com"
          }
          style={inputStyle}
        />
      </FieldRow>
      <FieldRow label="Nome amigável">
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Opcional"
          style={inputStyle}
        />
      </FieldRow>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 18,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rdv-btn rdv-btn-rec"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          {saving ? (
            <Loader2 size={11} className="rdv-spin" />
          ) : (
            <Plus size={11} />
          )}
          Adicionar
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--color-rdv-cream)",
          border: "1.5px solid var(--color-rdv-ink)",
          boxShadow: "10px 10px 0 0 var(--color-rdv-rec)",
          padding: "22px 24px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "white",
            border: "1.5px solid var(--color-rdv-line)",
            padding: 6,
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
        <h2
          className="rdv-display"
          style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 14 }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        className="rdv-mono"
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-rdv-muted)",
          marginBottom: 6,
          display: "block",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid var(--color-rdv-ink)",
  background: "white",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  outline: "none",
};

// `_` to suppress unused warning if PLATFORM_TO_CATEGORY isn't used downstream
void PLATFORM_TO_CATEGORY;
