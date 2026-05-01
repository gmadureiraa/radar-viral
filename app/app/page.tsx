"use client";

/**
 * /app — Dashboard v2.
 *
 * Por enquanto carrega o brief mais recente do mesmo Neon DB que a v1
 * popula via cron. Sem APIs próprias ainda — apenas leitura direta do DB
 * via `/api/data/*` da v1 (Vercel cross-project) ou via lib próprio de
 * Neon serverless. Pra MVP, lib próprio + queries diretas.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Sparkles,
  Bookmark,
  Flame,
  ArrowRight,
  Loader2,
} from "lucide-react";
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

interface DailyBrief {
  brief_date: string;
  narratives: BriefNarrative[] | null;
  hot_topics: BriefHotTopic[] | null;
  carousel_ideas: BriefCarouselIdea[] | null;
  cross_pollination?: Array<{ topic: string; sources: string[] }>;
  model_used?: string;
  cost_usd?: number;
}

export default function DashboardPage() {
  const session = useNeonSession();
  const { active: niche } = useActiveNiche();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.data?.user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const jwt = await getJwtToken();
        const res = await fetch(`/api/brief?niche=${niche.id}`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
        });
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as { brief: DailyBrief | null };
        if (!cancel) setBrief(data.brief);
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
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> DASHBOARD · {briefDateLabel ?? "AGUARDANDO BRIEF"}
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
      <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 32 }}>
        Brief diário cruzando Instagram, YouTube, notícias e newsletters.
      </p>

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
                {brief.hot_topics.slice(0, 6).map((t, i) => (
                  <TopicCard key={i} topic={t} rank={i + 1} />
                ))}
              </div>
            )}
          </Section>

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
                {brief.narratives.slice(0, 4).map((n, i) => (
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
                {brief.carousel_ideas.slice(0, 6).map((idea, i) => (
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

function TopicCard({ topic, rank }: { topic: BriefHotTopic; rank: number }) {
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
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
          <span className="rdv-mono" style={{ fontSize: 10, color: "var(--color-rdv-muted)" }}>
            {topic.signal_count} sinal{topic.signal_count === 1 ? "" : "is"} · {intensity}
          </span>
          <button
            type="button"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "5px 10px", fontSize: 9 }}
          >
            <Bookmark size={10} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function NarrativeCard({ narrative }: { narrative: BriefNarrative }) {
  return (
    <div className="rdv-card" style={{ padding: "16px 18px" }}>
      <h3 className="rdv-display" style={{ fontSize: 18, lineHeight: 1.15, marginBottom: 6 }}>
        {narrative.title}
      </h3>
      {narrative.why && (
        <p style={{ fontSize: 12.5, color: "var(--color-rdv-muted)", lineHeight: 1.45 }}>
          {narrative.why}
        </p>
      )}
      {narrative.signals?.length ? (
        <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 11.5, lineHeight: 1.5, color: "var(--color-rdv-muted)" }}>
          {narrative.signals.slice(0, 3).map((s, i) => (
            <li key={i}>{s}</li>
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
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <a
          href="https://viral.kaleidos.com.br"
          target="_blank"
          rel="noreferrer"
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "6px 10px", fontSize: 9 }}
        >
          Recriar no SV <ArrowRight size={9} />
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
