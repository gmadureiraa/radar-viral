"use client";

/**
 * /app/settings — gerenciar nicho ativo + fontes (Minhas + Curadas).
 *
 * Estrutura:
 *  1. Header: título + nicho selector + plano badge (Free X/3)
 *  2. Botão "Adicionar fonte" (modal)
 *  3. Tabs por plataforma (Todas + 7 plataformas)
 *  4. Lista unificada: minhas fontes + curadas do nicho (com toggle).
 *     Avatar, label, badge "Minha"/"Curada", ações (toggle/edit/delete).
 *  5. Modal "Adicionar fonte" — select plataforma + handle + display name.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Instagram,
  Youtube,
  Newspaper,
  Mail,
  Lock,
  Sparkles,
  Plus,
  Loader2,
  X,
  Pause,
  Play,
  Music2,
  AtSign,
  Hash,
  Rss,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useActiveNiche } from "@/lib/niche-context";
import {
  ALL_CURATED,
  type CuratedSource,
  type CuratedNiche,
  type CuratedPlatform,
} from "@/lib/sources-curated";
import { useNeonSession, getJwtToken } from "@/lib/auth-client";
import { NichePillBar } from "@/app/app/_components/niche-pill-bar";
import type { UserSourceRow } from "@/app/api/sources/route";

// ─── Types e mapeamentos ──────────────────────────────────────────────

type PlatformTab = "all" | CuratedPlatform;

const PLATFORM_TABS: PlatformTab[] = [
  "all",
  "instagram",
  "youtube",
  "tiktok",
  "threads",
  "twitter",
  "rss",
  "newsletter",
];

function platformLabel(p: PlatformTab): string {
  switch (p) {
    case "all":
      return "Todas";
    case "instagram":
      return "Instagram";
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "threads":
      return "Threads";
    case "twitter":
      return "X / Twitter";
    case "rss":
      return "RSS";
    case "newsletter":
      return "Newsletter";
  }
}

function platformIcon(p: PlatformTab): typeof Instagram {
  switch (p) {
    case "all":
      return Layers;
    case "instagram":
      return Instagram;
    case "youtube":
      return Youtube;
    case "tiktok":
      return Music2;
    case "threads":
      return AtSign;
    case "twitter":
      return Hash;
    case "rss":
      return Rss;
    case "newsletter":
      return Mail;
  }
}

interface SubInfo {
  plan: "free" | "pro" | "max";
  status: string;
  isPaid: boolean;
}

// ─── Página ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const session = useNeonSession();
  const { active } = useActiveNiche();
  const [tab, setTab] = useState<PlatformTab>("all");
  const [mySources, setMySources] = useState<UserSourceRow[]>([]);
  const [disabledCuratedKeys, setDisabledCuratedKeys] = useState<Set<string>>(new Set());
  const [curatedAvatars, setCuratedAvatars] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sub, setSub] = useState<SubInfo | null>(null);

  const totalCap = sub?.plan === "max" ? 100 : sub?.plan === "pro" ? 60 : 3;
  const planLabel = sub?.plan === "max" ? "Max" : sub?.plan === "pro" ? "Pro" : "Free";
  const isPaid = sub?.isPaid ?? false;
  const totalUsed = mySources.length;
  const totalRemaining = Math.max(0, totalCap - totalUsed);
  const totalCapReached = totalUsed >= totalCap;

  // Curadas do nicho ativo (filtra por nicho selecionado)
  const curatedForNiche = useMemo(() => {
    if (!["crypto", "marketing", "ai"].includes(active.id)) return [];
    return ALL_CURATED.filter((c) => c.niche === (active.id as CuratedNiche));
  }, [active.id]);

  // Fetch fontes do user
  const refreshMine = async () => {
    if (!session.data?.user) return;
    setLoading(true);
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/sources?niche=${active.id}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as { sources: UserSourceRow[] };
        setMySources(data.sources ?? []);
      } else if (res.status !== 401) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? `Falha ao carregar (${res.status})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  // Fetch curadas desativadas
  const refreshDisabledCurated = async () => {
    if (!session.data?.user) return;
    try {
      const jwt = await getJwtToken();
      const res = await fetch("/api/sources/curated", {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as { disabled: string[] };
        setDisabledCuratedKeys(new Set(data.disabled ?? []));
      }
    } catch {
      /* silencioso, default = nenhuma desabilitada */
    }
  };

  useEffect(() => {
    void refreshMine();
    void refreshDisabledCurated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data?.user?.id, active.id]);

  // Resolve avatares das curadas em batch (cache 30d server-side)
  useEffect(() => {
    if (!session.data?.user?.id || curatedForNiche.length === 0) return;
    const keys = curatedForNiche.map((c) => c.key);
    let cancelled = false;
    (async () => {
      try {
        const jwt = await getJwtToken();
        const res = await fetch("/api/sources/curated/avatars", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
          body: JSON.stringify({ keys }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { avatars: Record<string, string | null> };
        if (!cancelled) {
          setCuratedAvatars((prev) => ({ ...prev, ...data.avatars }));
        }
      } catch {
        /* silencioso, fallback inicial */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.data?.user?.id, active.id, curatedForNiche]);

  // Subscription
  useEffect(() => {
    if (!session.data?.user?.id) {
      setSub({ plan: "free", status: "active", isPaid: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const jwt = await getJwtToken();
        const res = await fetch("/api/me/subscription", {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setSub({ plan: "free", status: "active", isPaid: false });
          return;
        }
        const data = (await res.json()) as SubInfo;
        if (!cancelled) setSub(data);
      } catch {
        if (!cancelled) setSub({ plan: "free", status: "active", isPaid: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.data?.user?.id]);

  const handleToggleActive = async (s: UserSourceRow) => {
    try {
      const jwt = await getJwtToken();
      const res = await fetch("/api/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
        body: JSON.stringify({ id: s.id, active: !s.active }),
      });
      if (!res.ok) throw new Error("Falha");
      toast.success(s.active ? "Pausada" : "Ativada");
      void refreshMine();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleDelete = async (s: UserSourceRow) => {
    if (!window.confirm(`Excluir @${s.handle}?`)) return;
    try {
      const jwt = await getJwtToken();
      const res = await fetch(`/api/sources?id=${s.id}`, {
        method: "DELETE",
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast.success("Removida");
      void refreshMine();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleToggleCurated = async (key: string, currentlyDisabled: boolean) => {
    const newDisabled = !currentlyDisabled;
    // optimistic
    setDisabledCuratedKeys((prev) => {
      const next = new Set(prev);
      if (newDisabled) next.add(key);
      else next.delete(key);
      return next;
    });
    try {
      const jwt = await getJwtToken();
      const res = await fetch("/api/sources/curated", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
        body: JSON.stringify({ key, disabled: newDisabled }),
      });
      if (!res.ok) throw new Error("Falha");
      toast.success(newDisabled ? "Curada desativada" : "Curada ativada");
    } catch (err) {
      // rollback
      setDisabledCuratedKeys((prev) => {
        const next = new Set(prev);
        if (currentlyDisabled) next.add(key);
        else next.delete(key);
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  // Filtro por tab (plataforma)
  const filteredMine = mySources.filter((s) =>
    tab === "all" ? true : s.platform === platformBackendKey(tab),
  );
  const filteredCurated = curatedForNiche.filter((c) =>
    tab === "all" ? true : c.platform === tab,
  );

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> CONFIGURAÇÕES
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
        <h1 className="rdv-display" style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          Suas <em>fontes</em>.
        </h1>
        <PlanBadge plan={planLabel} used={totalUsed} cap={totalCap} reached={totalCapReached} />
      </div>
      <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 20, maxWidth: 720 }}>
        Adicione contas que você quer monitorar (cap {totalCap} no {planLabel}).
        Curadas são fontes pré-selecionadas Kaleidos do nicho — pode desativar
        se não quer no seu radar.
      </p>

      <NichePillBar />

      {/* Free upgrade nudge — só quando perto do cap */}
      {!isPaid && totalCapReached && (
        <div className="rdv-card" style={{ padding: "14px 18px", marginTop: 18, marginBottom: 14, display: "flex", alignItems: "center", gap: 14, borderColor: "var(--color-rdv-rec)", boxShadow: "4px 4px 0 0 var(--color-rdv-rec)", flexWrap: "wrap" }}>
          <Lock size={18} style={{ color: "var(--color-rdv-rec)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Limite Free atingido</div>
            <p style={{ fontSize: 12.5, color: "var(--color-rdv-muted)", lineHeight: 1.5 }}>
              Você usou {totalUsed}/{totalCap} fontes. Pro libera 60 + edição livre + briefs ilimitados.
            </p>
          </div>
          <Link href="/app/precos" className="rdv-btn rdv-btn-rec" style={{ padding: "8px 14px", fontSize: 10, whiteSpace: "nowrap" }}>
            <Sparkles size={11} /> Ver Pro
          </Link>
        </div>
      )}

      {/* Adicionar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <PlatformTabsBar tab={tab} onChange={setTab} mine={mySources} curated={curatedForNiche} />
        <button
          type="button"
          onClick={() => {
            if (totalCapReached) {
              toast.error(`Limite ${planLabel} (${totalCap}) atingido. Remova fontes ou faça upgrade.`);
              return;
            }
            setAdding(true);
          }}
          disabled={totalCapReached}
          className="rdv-btn rdv-btn-rec"
          style={{ padding: "10px 16px", fontSize: 12, opacity: totalCapReached ? 0.5 : 1, cursor: totalCapReached ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
        >
          <Plus size={13} /> Adicionar
          {!isPaid && totalRemaining > 0 ? <span style={{ opacity: 0.7, marginLeft: 4 }}>({totalRemaining})</span> : null}
        </button>
      </div>

      {loading && mySources.length === 0 && (
        <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
          <Loader2 size={20} className="rdv-spin" />
        </div>
      )}

      {/* Minhas fontes */}
      {filteredMine.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeader title="Minhas fontes" count={filteredMine.length} variant="mine" />
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {filteredMine.map((s) => (
              <MyCard key={s.id} source={s} onToggle={handleToggleActive} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* Curadas */}
      {filteredCurated.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeader title="Catálogo curado" count={filteredCurated.length} variant="curated" />
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {filteredCurated.map((c) => (
              <CuratedCard
                key={c.key}
                source={c}
                avatarUrl={curatedAvatars[c.key] ?? null}
                disabled={disabledCuratedKeys.has(c.key)}
                onToggle={(d) => handleToggleCurated(c.key, d)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty fallback */}
      {!loading && filteredMine.length === 0 && filteredCurated.length === 0 && (
        <div className="rdv-card" style={{ padding: 32, textAlign: "center", color: "var(--color-rdv-muted)" }}>
          Nenhuma fonte encontrada nessa categoria. Clique em <strong>Adicionar</strong>.
        </div>
      )}

      {adding && sub && (
        <AddSourceModal
          niche={active.id}
          plan={sub.plan}
          remainingTotal={totalRemaining}
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

// Backend platform key (instagram → "ig" map antigo, hoje 1:1 exceto rss/newsletter)
function platformBackendKey(p: CuratedPlatform): string {
  return p === "rss" ? "rss" : p; // já são iguais
}

// ─── PlanBadge ────────────────────────────────────────────────────────

function PlanBadge({ plan, used, cap, reached }: { plan: string; used: number; cap: number; reached: boolean }) {
  return (
    <div
      className="rdv-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        border: "1.5px solid var(--color-rdv-ink)",
        background: reached ? "var(--color-rdv-rec)" : "var(--color-rdv-paper)",
        color: reached ? "white" : "var(--color-rdv-ink)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        boxShadow: "2px 2px 0 0 var(--color-rdv-ink)",
      }}
    >
      <Sparkles size={11} /> {plan} · {used}/{cap}
    </div>
  );
}

// ─── PlatformTabsBar ──────────────────────────────────────────────────

function PlatformTabsBar({
  tab,
  onChange,
  mine,
  curated,
}: {
  tab: PlatformTab;
  onChange: (t: PlatformTab) => void;
  mine: UserSourceRow[];
  curated: CuratedSource[];
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", overflowX: "auto" }}>
      {PLATFORM_TABS.map((p) => {
        const isActive = p === tab;
        const Icon = platformIcon(p);
        const count =
          p === "all"
            ? mine.length + curated.length
            : mine.filter((s) => s.platform === platformBackendKey(p)).length +
              curated.filter((c) => c.platform === p).length;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            style={{
              padding: "7px 11px",
              border: "1.5px solid var(--color-rdv-ink)",
              background: isActive ? "var(--color-rdv-ink)" : "white",
              color: isActive ? "white" : "var(--color-rdv-ink)",
              cursor: "pointer",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              boxShadow: isActive ? "2px 2px 0 0 var(--color-rdv-rec)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              whiteSpace: "nowrap",
            }}
          >
            <Icon size={11} /> {platformLabel(p)}
            <span style={{ opacity: 0.7, fontWeight: 500 }}>· {count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────

function SectionHeader({ title, count, variant }: { title: string; count: number; variant: "mine" | "curated" }) {
  const accent = variant === "mine" ? "var(--color-rdv-rec)" : "var(--color-rdv-ink)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
      <span
        className="rdv-mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        ▮ {title}
      </span>
      <span
        className="rdv-mono"
        style={{
          fontSize: 10,
          color: "var(--color-rdv-muted)",
          letterSpacing: "0.14em",
        }}
      >
        {count} {count === 1 ? "item" : "itens"}
      </span>
    </div>
  );
}

// ─── MyCard ───────────────────────────────────────────────────────────

function MyCard({
  source,
  onToggle,
  onDelete,
}: {
  source: UserSourceRow;
  onToggle: (s: UserSourceRow) => void;
  onDelete: (s: UserSourceRow) => void;
}) {
  const [imgErrored, setImgErrored] = useState(false);
  const initial = (source.display_name ?? source.handle).replace(/^@/, "").charAt(0).toUpperCase();
  const showImage = !!source.avatar_url && !imgErrored;

  return (
    <div
      className="rdv-card"
      style={{
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: source.active ? 1 : 0.55,
        position: "relative",
      }}
    >
      <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "1.5px solid var(--color-rdv-ink)", background: showImage ? "transparent" : "var(--color-rdv-ink)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/img?url=${encodeURIComponent(source.avatar_url!)}`}
            alt={source.handle}
            loading="lazy"
            onError={() => setImgErrored(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 14, fontWeight: 800 }}>{initial}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {source.handle}
          </span>
          <span
            className="rdv-mono"
            style={{
              fontSize: 8.5,
              padding: "2px 5px",
              background: "var(--color-rdv-rec)",
              color: "white",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Minha
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-rdv-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {source.display_name ?? `${source.platform} · ${source.niche}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <IconBtn
          title={source.active ? "Pausar" : "Ativar"}
          onClick={() => onToggle(source)}
          icon={source.active ? <Pause size={12} /> : <Play size={12} />}
        />
        <IconBtn
          title="Excluir"
          onClick={() => onDelete(source)}
          icon={<Trash2 size={12} />}
          danger
        />
      </div>
    </div>
  );
}

// ─── CuratedCard ───────────────────────────────────────────────────────

function CuratedCard({
  source,
  avatarUrl,
  disabled,
  onToggle,
}: {
  source: CuratedSource;
  avatarUrl: string | null;
  disabled: boolean;
  onToggle: (currentlyDisabled: boolean) => void;
}) {
  const [imgErrored, setImgErrored] = useState(false);
  const initial = source.label.charAt(0).toUpperCase();
  const showImage = !!avatarUrl && !imgErrored;

  return (
    <div
      className="rdv-card"
      style={{
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "1.5px dashed var(--color-rdv-ink)", background: showImage ? "transparent" : "var(--color-rdv-paper)", color: "var(--color-rdv-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/img?url=${encodeURIComponent(avatarUrl!)}`}
            alt={source.label}
            loading="lazy"
            onError={() => setImgErrored(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initial
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {source.label}
          </span>
          <span
            className="rdv-mono"
            style={{
              fontSize: 8.5,
              padding: "2px 5px",
              background: "transparent",
              color: "var(--color-rdv-ink)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "1px solid var(--color-rdv-ink)",
            }}
          >
            Curada
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-rdv-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {source.detail ?? `@${source.handle}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {source.externalUrl && (
          <a
            href={source.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir"
            style={{
              width: 26,
              height: 26,
              border: "1px solid var(--color-rdv-line)",
              background: "transparent",
              color: "var(--color-rdv-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ExternalLink size={11} />
          </a>
        )}
        <IconBtn
          title={disabled ? "Reativar" : "Desativar"}
          onClick={() => onToggle(disabled)}
          icon={disabled ? <CheckCircle2 size={12} /> : <Pause size={12} />}
        />
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, icon, danger }: { title: string; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        border: "1px solid var(--color-rdv-line)",
        background: "transparent",
        color: danger ? "var(--color-rdv-rec)" : "var(--color-rdv-ink)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </button>
  );
}

// ─── AddSourceModal ────────────────────────────────────────────────────

function AddSourceModal({
  niche,
  plan,
  remainingTotal,
  onClose,
  onSaved,
}: {
  niche: string;
  plan: "free" | "pro" | "max";
  remainingTotal: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [platform, setPlatform] = useState<CuratedPlatform>("instagram");
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
        headers: { "Content-Type": "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,9,8,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rdv-card"
        style={{
          background: "var(--color-rdv-paper)",
          padding: 24,
          width: "100%",
          maxWidth: 460,
          boxShadow: "6px 6px 0 0 var(--color-rdv-ink)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div className="rdv-eyebrow" style={{ marginBottom: 4 }}>
              <span className="rdv-rec-dot" /> ADICIONAR FONTE
            </div>
            <h2 className="rdv-display" style={{ fontSize: 22, lineHeight: 1.05 }}>
              Cadastrar nova fonte
            </h2>
            {plan === "free" && (
              <p style={{ fontSize: 11, color: "var(--color-rdv-muted)", marginTop: 6 }}>
                Plano Free · {remainingTotal} {remainingTotal === 1 ? "vaga restante" : "vagas restantes"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "1px solid var(--color-rdv-line)", padding: 6, background: "transparent", cursor: "pointer" }}
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        <FieldRow label="Plataforma">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as CuratedPlatform)}
            style={inputStyle}
          >
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="threads">Threads</option>
            <option value="twitter">X / Twitter</option>
            <option value="rss">RSS Notícias</option>
            <option value="newsletter">Newsletter</option>
          </select>
        </FieldRow>

        <FieldRow label="Handle / URL">
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder={placeholderForPlatform(platform)}
            style={inputStyle}
          />
        </FieldRow>

        <FieldRow label="Nome (opcional)">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ex: Lucas Amendola · Bitcoin"
            style={inputStyle}
          />
        </FieldRow>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
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
            {saving ? <Loader2 size={11} className="rdv-spin" /> : <Plus size={11} />}
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span
        className="rdv-mono"
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--color-rdv-muted)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid var(--color-rdv-ink)",
  background: "white",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function placeholderForPlatform(p: CuratedPlatform): string {
  switch (p) {
    case "instagram":
      return "username (sem @)";
    case "youtube":
      return "@channelName ou UC...";
    case "tiktok":
      return "@usuario (sem @)";
    case "threads":
      return "username (sem @)";
    case "twitter":
      return "username (sem @)";
    case "rss":
      return "https://site.com/feed";
    case "newsletter":
      return "newsletter@dominio.com";
  }
}
