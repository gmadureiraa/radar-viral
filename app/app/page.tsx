"use client";

/**
 * /app — Dashboard v2.
 *
 * Por enquanto carrega o brief mais recente do mesmo Neon DB que a v1
 * popula via cron. Sem APIs próprias ainda — apenas leitura direta do DB
 * via `/api/data/*` da v1 (Vercel cross-project) ou via lib próprio de
 * Neon serverless. Pra MVP, lib próprio + queries diretas.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Flame,
  ArrowRight,
  Loader2,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useNeonSession, getJwtToken } from "@/lib/auth-client";
import { useActiveNiche } from "@/lib/niche-context";

interface BriefHotTopic {
  topic: string;
  signal_count: number;
  source_summary: string;
}

interface BriefNarrative {
  title: string;
  why: string;
  signals: string[];
}

interface BriefCarouselIdea {
  hook: string;
  angle: string;
}

interface BriefCrossPollination {
  topic: string;
  sources: string[];
}

interface DailyBrief {
  brief_date: string;
  narratives: BriefNarrative[] | null;
  hot_topics: BriefHotTopic[] | null;
  carousel_ideas: BriefCarouselIdea[] | null;
  cross_pollination?: BriefCrossPollination[] | null;
  model_used?: string;
  cost_usd?: number;
}

interface SubInfo {
  plan: "free" | "pro";
  status: string;
  isPaid: boolean;
}

export default function DashboardPage() {
  const session = useNeonSession();
  const { active: niche } = useActiveNiche();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedTopics, setSavedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session.data?.user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const [briefRes, subRes, savedRes] = await Promise.all([
          fetch(`/api/brief?niche=${niche.id}`, { headers }),
          fetch("/api/me/subscription", { headers }),
          fetch("/api/data/saved?platform=topic", { headers }),
        ]);
        if (!briefRes.ok) {
          setError(`HTTP ${briefRes.status}`);
          return;
        }
        const briefData = (await briefRes.json()) as { brief: DailyBrief | null };
        if (!cancel) setBrief(briefData.brief);

        if (subRes.ok) {
          const subData = (await subRes.json()) as SubInfo;
          if (!cancel) setSub(subData);
        }

        if (savedRes.ok) {
          const savedData = (await savedRes.json()) as {
            items: Array<{ ref_id: string }>;
          };
          if (!cancel) setSavedTopics(new Set((savedData.items ?? []).map((i) => i.ref_id)));
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
  }, [session.data?.user?.id, niche.id]);

  const handleSaveTopic = useCallback(
    async (topic: BriefHotTopic) => {
      const refId = topicRefId(topic.topic);
      const isSaved = savedTopics.has(refId);
      try {
        const jwt = await getJwtToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

        if (isSaved) {
          const res = await fetch(
            `/api/data/saved?platform=topic&refId=${encodeURIComponent(refId)}`,
            { method: "DELETE", headers },
          );
          if (!res.ok) throw new Error("Falha ao remover");
          setSavedTopics((prev) => {
            const next = new Set(prev);
            next.delete(refId);
            return next;
          });
          toast.success("Tema removido dos salvos");
        } else {
          const res = await fetch("/api/data/saved", {
            method: "POST",
            headers,
            body: JSON.stringify({
              platform: "topic",
              refId,
              nicheSlug: niche.id,
              title: topic.topic,
              note: topic.source_summary,
            }),
          });
          if (!res.ok) throw new Error("Falha ao salvar");
          setSavedTopics((prev) => new Set(prev).add(refId));
          toast.success("Tema salvo");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [savedTopics, niche.id],
  );

  const userFirstName = useMemo(() => {
    const u = session.data?.user;
    if (!u) return "";
    if (u.name) return u.name.split(" ")[0];
    if (u.email) return u.email.split("@")[0].split(".")[0];
    return "";
  }, [session.data?.user]);

  const briefDateLabel = brief
    ? new Date(brief.brief_date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      })
    : null;

  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <div className="rdv-eyebrow">
          <span className="rdv-rec-dot" /> DASHBOARD · {briefDateLabel ?? "AGUARDANDO BRIEF"}
        </div>
        {sub && <PlanPill plan={sub.plan} />}
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
        Olá{userFirstName ? <>, <em>{userFirstName}</em></> : <em></em>}.
        Aqui o que <em>importa</em> hoje.
      </h1>
      <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 24 }}>
        Brief diário cruzando Instagram, YouTube, notícias e newsletters
        {niche.label ? <> em <strong>{niche.label}</strong></> : null}.
      </p>

      {sub && !sub.isPaid && (
        <div
          style={{
            background: "rgba(255, 61, 46, 0.06)",
            border: "1.5px solid var(--color-rdv-rec)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="rdv-eyebrow" style={{ marginBottom: 4 }}>
              <span className="rdv-rec-dot" /> RADAR COMPARTILHADO
            </div>
            <p style={{ fontSize: 13, color: "var(--color-rdv-ink)" }}>
              Você está vendo o radar global. No Pro, ativamos cron individual com suas fontes.
            </p>
          </div>
          <Link
            href="/app/precos"
            className="rdv-btn rdv-btn-rec"
            style={{ padding: "10px 16px", fontSize: 11, whiteSpace: "nowrap" }}
          >
            Ver Pro <ArrowRight size={11} />
          </Link>
        </div>
      )}

      {loading && !brief && (
        <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      )}

      {error && !brief && (
        <div className="rdv-card" style={{ padding: 24, marginBottom: 18, borderColor: "var(--color-rdv-rec)" }}>
          <div className="rdv-eyebrow" style={{ marginBottom: 8 }}>
            <span className="rdv-rec-dot" /> ERRO
          </div>
          <p>{error}</p>
        </div>
      )}

      {brief && (
        <>
          {/* TEMAS EM ALTA — destaque do dashboard */}
          <Section
            title="Temas em alta"
            subtitle={`Cruzamento news + IG · ${brief.hot_topics?.length ?? 0} sinais detectados`}
            icon={<Flame size={16} />}
          >
            {!brief.hot_topics?.length ? (
              <Empty msg="Sem sinais fortes hoje." />
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {(brief.hot_topics ?? []).slice(0, 6).map((t, i) => (
                  <TopicCard
                    key={i}
                    topic={t}
                    rank={i + 1}
                    saved={savedTopics.has(topicRefId(t.topic))}
                    onToggleSave={() => void handleSaveTopic(t)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* CROSS-POLLINATION — ponte entre fontes */}
          {brief.cross_pollination?.length ? (
            <Section
              title="Pontes entre fontes"
              subtitle="Quando o mesmo tema aparece em mais de um lugar"
              icon={<Lightbulb size={16} />}
            >
              <div style={{ display: "grid", gap: 12 }}>
                {(brief.cross_pollination ?? []).slice(0, 4).map((c, i) => (
                  <CrossCard key={i} cross={c} />
                ))}
              </div>
            </Section>
          ) : null}

          {/* NARRATIVAS DOMINANTES */}
          <Section
            title="Narrativas dominantes"
            subtitle="O que a IA detectou repetindo nas fontes"
            icon={<Activity size={16} />}
          >
            {!brief.narratives?.length ? (
              <Empty msg="Nenhuma narrativa detectada." />
            ) : (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                {(brief.narratives ?? []).slice(0, 4).map((n, i) => (
                  <NarrativeCard key={i} narrative={n} />
                ))}
              </div>
            )}
          </Section>

          {/* IDEIAS PRONTAS */}
          {brief.carousel_ideas?.length ? (
            <Section
              title="Ideias prontas pra postar"
              subtitle="Hook + ângulo gerados pelo brief"
              icon={<Sparkles size={16} />}
            >
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                {(brief.carousel_ideas ?? []).slice(0, 6).map((idea, i) => (
                  <IdeaCard key={i} idea={idea} />
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}
    </main>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="rdv-display" style={{ fontSize: 26, lineHeight: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--color-rdv-rec)" }}>{icon}</span>
          {title}
        </div>
        {subtitle && (
          <span className="rdv-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-rdv-muted)" }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function TopicCard({
  topic,
  rank,
  saved,
  onToggleSave,
}: {
  topic: BriefHotTopic;
  rank: number;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const filled = topic.signal_count >= 6 ? 3 : topic.signal_count >= 3 ? 2 : 1;
  const intensity = filled === 3 ? "forte" : filled === 2 ? "médio" : "fraco";
  return (
    <div
      style={{
        background: rank === 1 ? "rgba(255, 61, 46, 0.08)" : "var(--color-rdv-cream)",
        border: `1.5px solid ${rank === 1 ? "var(--color-rdv-rec)" : "var(--color-rdv-ink)"}`,
        boxShadow: rank === 1 ? "5px 5px 0 0 var(--color-rdv-rec)" : "3px 3px 0 0 var(--color-rdv-ink)",
        padding: "14px 18px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          background: rank === 1 ? "var(--color-rdv-rec)" : "rgba(255, 61, 46, 0.18)",
          color: rank === 1 ? "white" : "var(--color-rdv-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-geist-mono)",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        #{rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
            {topic.topic}
          </h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }} title={`${topic.signal_count} sinais · ${intensity}`}>
            {[0, 1, 2].map((bar) => (
              <span
                key={bar}
                style={{
                  width: 3,
                  height: 4 + bar * 3,
                  background: bar < filled ? "var(--color-rdv-rec)" : "rgba(255, 61, 46, 0.25)",
                }}
              />
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--color-rdv-muted)", lineHeight: 1.45 }}>
          {topic.source_summary}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="rdv-mono" style={{ fontSize: 10, color: "var(--color-rdv-muted)" }}>
            {topic.signal_count} sinal{topic.signal_count === 1 ? "" : "is"} · {intensity}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <Link
              href={`/app/news?q=${encodeURIComponent(topic.topic)}`}
              className="rdv-btn rdv-btn-ghost"
              style={{ padding: "5px 10px", fontSize: 9 }}
            >
              <ExternalLink size={10} /> Ver notícias
            </Link>
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
    </div>
  );
}

function CrossCard({ cross }: { cross: BriefCrossPollination }) {
  return (
    <div
      className="rdv-card"
      style={{
        padding: "14px 18px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <Lightbulb
        size={18}
        style={{ color: "var(--color-rdv-amber)", flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>
          {cross.topic}
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(cross.sources ?? []).map((s, i) => (
            <span
              key={i}
              className="rdv-mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "3px 8px",
                background: "var(--color-rdv-paper)",
                border: "1px solid var(--color-rdv-line)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanPill({ plan }: { plan: "free" | "pro" }) {
  const isPro = plan === "pro";
  return (
    <span
      className="rdv-mono"
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        padding: "4px 10px",
        background: isPro ? "var(--color-rdv-rec)" : "transparent",
        color: isPro ? "white" : "var(--color-rdv-muted)",
        border: `1px solid ${isPro ? "var(--color-rdv-rec)" : "var(--color-rdv-line)"}`,
      }}
    >
      {isPro ? "PRO" : "FREE"}
    </span>
  );
}

function topicRefId(topic: string): string {
  return topic
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function NarrativeCard({ narrative }: { narrative: BriefNarrative }) {
  // Schema do DB grava `explanation` + `sources`, mas a interface `BriefNarrative`
  // anterior tipava como `why` + `signals`. Suporta ambos pra retrocompat.
  const description =
    (narrative as { explanation?: string }).explanation ?? narrative.why;
  const items =
    (narrative as { sources?: unknown[] }).sources ?? narrative.signals ?? [];
  return (
    <div className="rdv-card" style={{ padding: "16px 18px" }}>
      <h3 className="rdv-display" style={{ fontSize: 18, lineHeight: 1.15, marginBottom: 6 }}>
        {narrative.title}
      </h3>
      {description && (
        <p style={{ fontSize: 12.5, color: "var(--color-rdv-muted)", lineHeight: 1.45 }}>
          {description}
        </p>
      )}
      {Array.isArray(items) && items.length > 0 ? (
        <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 11.5, lineHeight: 1.5, color: "var(--color-rdv-muted)" }}>
          {items.slice(0, 3).map((s, i) => (
            <li key={i}>{typeof s === "string" ? s : JSON.stringify(s)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function IdeaCard({ idea }: { idea: BriefCarouselIdea }) {
  return (
    <div className="rdv-card" style={{ padding: "16px 18px" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 8 }}>
        IDEIA
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>
        &ldquo;{idea.hook}&rdquo;
      </p>
      <p style={{ fontSize: 12, color: "var(--color-rdv-muted)", lineHeight: 1.5 }}>
        {idea.angle}
      </p>
      <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <a
          href={`https://viral.kaleidos.com.br/?brief=${encodeURIComponent(idea.hook)}`}
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 10px", fontSize: 9 }}
        >
          Carrossel SV <ArrowRight size={9} />
        </a>
        <a
          href="https://reels-viral.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 10px", fontSize: 9 }}
        >
          Reels RV <ArrowRight size={9} />
        </a>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rdv-card" style={{ padding: 20, textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "var(--color-rdv-muted)" }}>{msg}</p>
    </div>
  );
}
