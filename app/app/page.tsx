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
  Layers,
  Film,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useNeonSession, getJwtToken } from "@/lib/auth-client";
import { useActiveNiche } from "@/lib/niche-context";
import { TopNewsSection } from "./_components/top-news-section";
import { TopInstagramSection } from "./_components/top-instagram-section";
import { TopYouTubeSection } from "./_components/top-youtube-section";
import { LoopClosureSection } from "./_components/loop-closure-section";

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
  plan: "free" | "pro" | "max";
  status: string;
  isPaid: boolean;
}

export default function DashboardPage() {
  const session = useNeonSession();
  const { active: niche } = useActiveNiche();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [previousBrief, setPreviousBrief] = useState<DailyBrief | null>(null);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedTopics, setSavedTopics] = useState<Set<string>>(new Set());
  const [savedIdeas, setSavedIdeas] = useState<Set<string>>(new Set());
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (!session.data?.user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const [briefRes, subRes, savedTopicRes, savedIdeaRes, syncRes] =
          await Promise.all([
            fetch(`/api/brief?niche=${niche.id}`, { headers }),
            fetch("/api/me/subscription", { headers }),
            fetch("/api/data/saved?platform=topic", { headers }),
            fetch("/api/data/saved?platform=idea", { headers }),
            fetch("/api/last-sync"),
          ]);
        if (!briefRes.ok) {
          setError(`HTTP ${briefRes.status}`);
          return;
        }
        const briefData = (await briefRes.json()) as {
          brief: DailyBrief | null;
          previous: DailyBrief | null;
        };
        if (!cancel) {
          setBrief(briefData.brief);
          setPreviousBrief(briefData.previous);
        }

        if (subRes.ok) {
          const subData = (await subRes.json()) as SubInfo;
          if (!cancel) setSub(subData);
        }

        if (savedTopicRes.ok) {
          const savedData = (await savedTopicRes.json()) as {
            items: Array<{ ref_id: string }>;
          };
          if (!cancel) setSavedTopics(new Set((savedData.items ?? []).map((i) => i.ref_id)));
        }

        if (savedIdeaRes.ok) {
          const savedData = (await savedIdeaRes.json()) as {
            items: Array<{ ref_id: string }>;
          };
          if (!cancel) setSavedIdeas(new Set((savedData.items ?? []).map((i) => i.ref_id)));
        }

        if (syncRes.ok) {
          const syncData = (await syncRes.json()) as { latest: string | null };
          if (!cancel) setLastSync(syncData.latest);
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

  const handleSaveIdea = useCallback(
    async (idea: BriefCarouselIdea) => {
      const refId = topicRefId(idea.hook);
      const isSaved = savedIdeas.has(refId);
      try {
        const jwt = await getJwtToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

        if (isSaved) {
          const res = await fetch(
            `/api/data/saved?platform=idea&refId=${encodeURIComponent(refId)}`,
            { method: "DELETE", headers },
          );
          if (!res.ok) throw new Error("Falha ao remover");
          setSavedIdeas((prev) => {
            const next = new Set(prev);
            next.delete(refId);
            return next;
          });
          toast.success("Ideia removida dos salvos");
        } else {
          const res = await fetch("/api/data/saved", {
            method: "POST",
            headers,
            body: JSON.stringify({
              platform: "idea",
              refId,
              nicheSlug: niche.id,
              title: idea.hook,
              note: idea.angle,
            }),
          });
          if (!res.ok) throw new Error("Falha ao salvar");
          setSavedIdeas((prev) => new Set(prev).add(refId));
          toast.success("Ideia salva");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [savedIdeas, niche.id],
  );

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
        {lastSync && (
          <span
            className="rdv-mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-rdv-muted)",
              padding: "3px 8px",
              border: "1px solid var(--color-rdv-line)",
            }}
            title={`Última ingestão: ${new Date(lastSync).toLocaleString("pt-BR")}`}
          >
            <span style={{ marginRight: 6 }}>◴</span>
            ATUALIZADO {formatRelativeTime(lastSync)}
          </span>
        )}
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
          {/* LOOP CLOSURE — recap do brief de ontem (só renderiza se houver D-1) */}
          <LoopClosureSection yesterday={previousBrief} today={brief} />

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
                    velocity={computeVelocity(t, previousBrief)}
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
                  <IdeaCard
                    key={i}
                    idea={idea}
                    saved={savedIdeas.has(topicRefId(idea.hook))}
                    onToggleSave={() => void handleSaveIdea(idea)}
                  />
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}

      {/* ─── DIVISOR ENTRE BRIEF IA E CONTEÚDO BRUTO ─────────────────── */}
      {session.data?.user && (
        <div
          style={{
            margin: "44px 0 28px",
            padding: "0 0 12px",
            borderBottom: "1.5px solid var(--color-rdv-line)",
          }}
        >
          <div className="rdv-eyebrow">
            <span className="rdv-rec-dot" /> CONTEÚDO BRUTO · ÚLTIMAS 48H
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-rdv-muted)",
              marginTop: 6,
              maxWidth: 620,
            }}
          >
            O que tá saindo agora nas suas fontes, sem a curadoria da IA. Pega
            ideia direto da fonte.
          </p>
        </div>
      )}

      {session.data?.user && (
        <>
          <TopNewsSection nicheId={niche.id} isPaid={Boolean(sub?.isPaid)} />
          <TopInstagramSection nicheId={niche.id} isPaid={Boolean(sub?.isPaid)} />
          <TopYouTubeSection nicheId={niche.id} isPaid={Boolean(sub?.isPaid)} />
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
  velocity,
}: {
  topic: BriefHotTopic;
  rank: number;
  saved: boolean;
  onToggleSave: () => void;
  velocity: VelocityKind;
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
          {velocity !== "neutral" && <VelocityBadge kind={velocity} />}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--color-rdv-muted)", lineHeight: 1.45 }}>
          {topic.source_summary}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="rdv-mono" style={{ fontSize: 10, color: "var(--color-rdv-muted)" }}>
            {topic.signal_count} sinal{topic.signal_count === 1 ? "" : "is"} · {intensity}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Link
              href={`/app/news?q=${encodeURIComponent(topic.topic)}`}
              className="rdv-btn rdv-btn-ghost"
              style={{ padding: "5px 10px", fontSize: 9 }}
            >
              <ExternalLink size={10} /> Ver notícias
            </Link>
            <a
              href={svBridgeUrl(topic.topic, topic.source_summary)}
              target="_blank"
              rel="noreferrer"
              className="rdv-btn rdv-btn-ghost"
              style={{ padding: "5px 10px", fontSize: 9 }}
            >
              <Layers size={10} /> Carrossel SV
            </a>
            <a
              href={rvBridgeUrl(topic.topic)}
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
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a
            href={svBridgeUrl(
              cross.topic,
              `Cruzamento de fontes: ${(cross.sources ?? []).join(", ")}`,
            )}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <Layers size={10} /> Conteúdo cruzado
          </a>
          <a
            href={rvBridgeUrl(cross.topic)}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <Film size={10} /> Reel RV
          </a>
        </div>
      </div>
    </div>
  );
}

function PlanPill({ plan }: { plan: "free" | "pro" | "max" }) {
  const isPaid = plan === "pro" || plan === "max";
  const isMax = plan === "max";
  // Max usa lime/emerald brilhante (mais "premium" que o coral REC do Pro).
  const bg = isMax
    ? "#10B981"
    : isPaid
      ? "var(--color-rdv-rec)"
      : "transparent";
  const border = isMax
    ? "#10B981"
    : isPaid
      ? "var(--color-rdv-rec)"
      : "var(--color-rdv-line)";
  return (
    <span
      className="rdv-mono"
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        padding: "4px 10px",
        background: bg,
        color: isPaid ? "white" : "var(--color-rdv-muted)",
        border: `1px solid ${border}`,
      }}
    >
      {plan.toUpperCase()}
    </span>
  );
}

/**
 * Helpers de bridge Radar → Sequência Viral / Reels Viral.
 *
 * SV (`/app/create/new?idea=...`) consome `?idea=` e abre o editor com brief
 * preenchido. Concatenamos title + context num único campo textual pra IA
 * ter material rico de partida.
 *
 * RV (`https://reels-viral.vercel.app/?topic=...`) consome `?topic=` na
 * landing (app/page.tsx:76), salva em sessionStorage e redireciona pra /app
 * — onde o form completo abre com tema pre-preenchido.
 */
function svBridgeUrl(title: string, context?: string): string {
  const parts = [`Tema: ${title}`];
  if (context && context.trim().length > 0) {
    parts.push(`Contexto: ${context.trim()}`);
  }
  parts.push(
    "Crie um carrossel de 6-8 slides explorando esse ângulo, em PT-BR, linguagem simples e direta.",
  );
  const idea = parts.join("\n");
  return `https://viral.kaleidos.com.br/app/create/new?idea=${encodeURIComponent(idea)}`;
}

function rvBridgeUrl(topic: string): string {
  return `https://reels-viral.vercel.app/?topic=${encodeURIComponent(topic)}`;
}

type VelocityKind = "novo" | "subindo" | "explosao" | "neutral";

function computeVelocity(
  topic: BriefHotTopic,
  previous: DailyBrief | null,
): VelocityKind {
  if (!previous?.hot_topics) return topic.signal_count >= 3 ? "novo" : "neutral";
  const yKey = topic.topic
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  let bestScore = 0;
  let bestPrev: BriefHotTopic | null = null;
  for (const p of previous.hot_topics) {
    const pKey = p.topic
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const tokensA = new Set(yKey.split(" ").filter((t) => t.length > 2));
    const tokensB = new Set(pKey.split(" ").filter((t) => t.length > 2));
    let inter = 0;
    for (const t of tokensA) if (tokensB.has(t)) inter++;
    const union = tokensA.size + tokensB.size - inter;
    const score = union === 0 ? 0 : inter / union;
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestPrev = p;
    }
  }
  if (!bestPrev) return topic.signal_count >= 3 ? "novo" : "neutral";
  const ratio = topic.signal_count / Math.max(1, bestPrev.signal_count);
  if (ratio >= 2 && topic.signal_count >= 3) return "explosao";
  if (topic.signal_count > bestPrev.signal_count) return "subindo";
  return "neutral";
}

function VelocityBadge({ kind }: { kind: VelocityKind }) {
  if (kind === "neutral") return null;
  const config = {
    novo: { label: "NOVO", icon: <Zap size={9} />, color: "#10B981" },
    subindo: { label: "SUBINDO", icon: <TrendingUp size={9} />, color: "var(--color-rdv-rec)" },
    explosao: { label: "EXPLODINDO", icon: <Flame size={9} />, color: "var(--color-rdv-rec)" },
  }[kind];
  const isExplosao = kind === "explosao";
  return (
    <span
      className="rdv-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 8.5,
        fontWeight: 800,
        letterSpacing: "0.16em",
        padding: "3px 7px",
        background: isExplosao ? config.color : "transparent",
        color: isExplosao ? "white" : config.color,
        border: `1px solid ${config.color}`,
      }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - t;
  if (Number.isNaN(t) || diffMs < 0) return "AGORA";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "AGORA";
  const min = Math.floor(sec / 60);
  if (min < 60) return `HÁ ${min} MIN`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `HÁ ${hr}H`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "ONTEM";
  return `HÁ ${days}D`;
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
      <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <a
          href={svBridgeUrl(narrative.title, description)}
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "5px 10px", fontSize: 9 }}
        >
          <Layers size={10} /> Carrossel desse ângulo
        </a>
        <a
          href={rvBridgeUrl(narrative.title)}
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "5px 10px", fontSize: 9 }}
        >
          <Film size={10} /> Reel RV
        </a>
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  saved,
  onToggleSave,
}: {
  idea: BriefCarouselIdea;
  saved: boolean;
  onToggleSave: () => void;
}) {
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
          href={svBridgeUrl(idea.hook, idea.angle)}
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "5px 10px", fontSize: 9 }}
        >
          <Layers size={10} /> Carrossel SV
        </a>
        <a
          href={rvBridgeUrl(idea.hook)}
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
          {saved ? <BookmarkCheck size={10} /> : <Bookmark size={10} />}{" "}
          {saved ? "Salva" : "Salvar"}
        </button>
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
