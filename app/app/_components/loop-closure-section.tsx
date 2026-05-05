"use client";

/**
 * Loop closure: "Ontem você viu, hoje virou".
 *
 * Compara hot_topics do brief de ontem (D-1) com os de hoje (D0). Pra cada
 * topic de ontem, calcula:
 *   - delta = signal_count(hoje) - signal_count(ontem)
 *   - status = bombou (delta > 0 e ainda forte) | estável | esfriou
 *
 * Ajuda a validar a confiabilidade do radar e cria hábito de leitura: se o
 * que apareceu ontem realmente subiu, o brief é confiável. Se sumiu, é ruído.
 */

import Link from "next/link";
import { TrendingUp, Minus, TrendingDown, History } from "lucide-react";

interface BriefHotTopic {
  topic: string;
  signal_count: number;
  source_summary: string;
}

interface BriefSlim {
  brief_date: string;
  hot_topics: BriefHotTopic[] | null;
}

type Status = "bombou" | "estavel" | "esfriou";

interface RecapItem {
  topic: string;
  yesterdayCount: number;
  todayCount: number;
  delta: number;
  status: Status;
}

function topicKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(b.split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union;
}

function computeRecap(yesterday: BriefSlim, today: BriefSlim): RecapItem[] {
  const yest = yesterday.hot_topics ?? [];
  const tod = today.hot_topics ?? [];
  if (yest.length === 0) return [];

  return yest.slice(0, 5).map((y) => {
    const yKey = topicKey(y.topic);
    let bestMatch: BriefHotTopic | null = null;
    let bestScore = 0;
    for (const t of tod) {
      const score = jaccardSimilarity(yKey, topicKey(t.topic));
      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestMatch = t;
      }
    }
    const todayCount = bestMatch?.signal_count ?? 0;
    const delta = todayCount - y.signal_count;
    let status: Status;
    if (todayCount === 0) status = "esfriou";
    else if (delta > 0) status = "bombou";
    else if (delta < -1) status = "esfriou";
    else status = "estavel";
    return {
      topic: y.topic,
      yesterdayCount: y.signal_count,
      todayCount,
      delta,
      status,
    };
  });
}

const STATUS_STYLE: Record<
  Status,
  { label: string; bg: string; border: string; iconColor: string }
> = {
  bombou: {
    label: "BOMBOU",
    bg: "rgba(255, 61, 46, 0.10)",
    border: "var(--color-rdv-rec)",
    iconColor: "var(--color-rdv-rec)",
  },
  estavel: {
    label: "ESTÁVEL",
    bg: "var(--color-rdv-cream)",
    border: "var(--color-rdv-line)",
    iconColor: "var(--color-rdv-muted)",
  },
  esfriou: {
    label: "ESFRIOU",
    bg: "var(--color-rdv-paper)",
    border: "var(--color-rdv-line)",
    iconColor: "var(--color-rdv-muted)",
  },
};

function StatusIcon({ status }: { status: Status }) {
  const sz = 14;
  const color = STATUS_STYLE[status].iconColor;
  if (status === "bombou") return <TrendingUp size={sz} style={{ color }} />;
  if (status === "esfriou") return <TrendingDown size={sz} style={{ color }} />;
  return <Minus size={sz} style={{ color }} />;
}

export function LoopClosureSection({
  yesterday,
  today,
}: {
  yesterday: BriefSlim | null;
  today: BriefSlim | null;
}) {
  if (!yesterday || !today) return null;
  const items = computeRecap(yesterday, today);
  if (items.length === 0) return null;

  const yesterdayLabel = new Date(yesterday.brief_date).toLocaleDateString(
    "pt-BR",
    { day: "2-digit", month: "long" },
  );
  const bombouCount = items.filter((i) => i.status === "bombou").length;
  const stayed = items.filter((i) => i.status !== "esfriou").length;

  return (
    <section style={{ marginBottom: 36 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 14,
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
          <span style={{ color: "var(--color-rdv-rec)" }}>
            <History size={16} />
          </span>
          Ontem virou
        </div>
        <span
          className="rdv-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-rdv-muted)",
          }}
        >
          Recap do brief de {yesterdayLabel} · {bombouCount}/{items.length}{" "}
          ainda forte
        </span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, i) => {
          const style = STATUS_STYLE[item.status];
          const deltaText =
            item.status === "bombou"
              ? `+${item.delta} sinais`
              : item.status === "esfriou"
                ? item.todayCount === 0
                  ? "saiu do radar"
                  : `${item.delta} sinais`
                : "mesma força";
          return (
            <Link
              key={i}
              href={`/app/news?q=${encodeURIComponent(item.topic)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                background: style.bg,
                border: `1.5px solid ${style.border}`,
                boxShadow:
                  item.status === "bombou"
                    ? "3px 3px 0 0 var(--color-rdv-rec)"
                    : "2px 2px 0 0 var(--color-rdv-line)",
                textDecoration: "none",
                color: "inherit",
                transition: "transform 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translate(-1px, -1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translate(0, 0)";
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    item.status === "bombou"
                      ? "rgba(255, 61, 46, 0.18)"
                      : "rgba(0, 0, 0, 0.04)",
                  borderRadius: 4,
                }}
              >
                <StatusIcon status={item.status} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: "var(--color-rdv-ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.topic}
                </p>
                <p
                  className="rdv-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-rdv-muted)",
                    marginTop: 2,
                  }}
                >
                  {item.yesterdayCount} → {item.todayCount} · {deltaText}
                </p>
              </div>
              <span
                className="rdv-mono"
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  padding: "4px 8px",
                  background: style.border,
                  color: item.status === "bombou" ? "white" : "var(--color-rdv-paper)",
                  flexShrink: 0,
                }}
              >
                {style.label}
              </span>
            </Link>
          );
        })}
      </div>

      {stayed === 0 && (
        <p
          style={{
            marginTop: 10,
            fontSize: 11.5,
            color: "var(--color-rdv-muted)",
            fontStyle: "italic",
          }}
        >
          Nenhum tema de ontem manteve sinal hoje. Pode ser ruído na curadoria
          ou ciclo curto demais. Olha os temas de hoje abaixo.
        </p>
      )}
    </section>
  );
}
