/**
 * /api/cron/brief — Schedule diário 10:00 UTC.
 *
 * Portado de `code/_archive/viral-hunter-v1-legacy/api/cron/brief.ts`.
 *
 * Gera daily_brief por nicho usando Gemini 2.5 Flash:
 *  1. Coleta sinais das últimas 48h (news + ig)
 *  2. Monta prompt e chama Gemini Flash com response_mime_type=application/json
 *  3. UPSERT em daily_briefs (UNIQUE niche_id+brief_date OR niche+brief_date)
 *
 * Idempotência: ON CONFLICT atualiza brief do dia se rerodado.
 *
 * Multi-tenant simplificado: v2 ainda usa global niches (crypto/marketing/ai).
 * Quando user_niches estiver popular pra v2, expandir.
 *
 * Dry-run (?dry=true): mostra signals collected sem chamar Gemini.
 */

import { NICHES } from "@/lib/niches";
import { checkCronAuth, isCronEnabled, getCronSql, logCronRun, jsonResponse } from "@/lib/cron-utils";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const maxDuration = 300;

type SqlClient = NeonQueryFunction<false, false>;

interface NewsRow {
  title: string;
  source_name: string;
  description: string | null;
  link: string;
}
interface IgRow {
  account_handle: string;
  caption: string | null;
  likes: number;
  comments: number;
}

async function collectSignals(sql: SqlClient, nicheSlug: string) {
  const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const [newsRaw, igRaw] = await Promise.all([
    sql`
      SELECT title, source_name, description, link
        FROM news_articles
       WHERE niche = ${nicheSlug} AND pub_date >= ${cutoff}
       ORDER BY pub_date DESC LIMIT 15
    `,
    sql`
      SELECT account_handle, caption, likes, comments
        FROM instagram_posts
       WHERE niche = ${nicheSlug} AND posted_at >= ${cutoff}
       ORDER BY likes DESC LIMIT 10
    `,
  ]);
  const news = newsRaw as unknown as NewsRow[];
  const ig = igRaw as unknown as IgRow[];
  return {
    news,
    ig,
    counts: { news: news.length, ig: ig.length },
  };
}

interface BriefResponse {
  narratives: Array<{ title: string; explanation: string; sources?: string[] }>;
  hot_topics: Array<{ topic: string; signal_count: number; source_summary: string }>;
  carousel_ideas: Array<{ hook: string; angle: string; evidence: string; suggested_cta: string }>;
  cross_pollination?: Array<{ from_niche: string; to_niche: string; why: string }>;
}

function buildPrompt(
  niche: { id: string; label: string; description: string },
  otherSlugs: string[],
  signals: Awaited<ReturnType<typeof collectSignals>>,
): string {
  const otherTwo = otherSlugs.slice(0, 2);
  const otherDesc = otherTwo.length > 0 ? otherTwo.join(" e ") : "outros nichos";
  return [
    `Você é um analista editorial de conteúdo viral. Analise os SINAIS abaixo das últimas 48h do nicho "${niche.label}" (${niche.description}) e produza UM brief estratégico em JSON.`,
    "",
    `# SINAIS (top items por engagement)`,
    "",
    `## 📰 Notícias (${signals.news.length})`,
    ...signals.news.slice(0, 12).map(
      (n) => `- [${n.source_name}] ${n.title}${n.description ? ` — ${n.description.slice(0, 100)}` : ""}`,
    ),
    "",
    `## 📸 Instagram top likes (${signals.ig.length})`,
    ...signals.ig.slice(0, 8).map(
      (i) => `- @${i.account_handle} · ❤${i.likes} · ${(i.caption ?? "").slice(0, 120)}`,
    ),
    "",
    `# OUTPUT — apenas este JSON, sem markdown fences:`,
    `{`,
    `  "narratives": [{ "title": "string curta", "explanation": "1-2 frases", "sources": ["ref 1"] }],`,
    `  "hot_topics": [{ "topic": "termo chave", "signal_count": 0, "source_summary": "frase" }],`,
    `  "carousel_ideas": [{ "hook": "FRASE CAIXA ALTA", "angle": "twist", "evidence": "dado", "suggested_cta": "CTA" }],`,
    `  "cross_pollination": [{ "from_niche": "${niche.id}", "to_niche": "${otherTwo[0] ?? "outro"}", "why": "como serve em ${otherDesc}" }]`,
    `}`,
    "",
    `Regras: PT-BR coloquial; concretude (nomes/números); 3 narrativas; 5 hot_topics; 3 carousel_ideas; cross_pollination opcional.`,
    `Primeiro caractere = '{', último = '}'.`,
  ].join("\n");
}

async function generateBrief(
  niche: { id: string; label: string; description: string },
  otherSlugs: string[],
  signals: Awaited<ReturnType<typeof collectSignals>>,
): Promise<BriefResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = buildPrompt(niche, otherSlugs, signals);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    console.warn(`[brief] gemini ${res.status}: ${await res.text().catch(() => "")}`);
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as BriefResponse;
  } catch (err) {
    console.warn("[brief] parse error", err);
    return null;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.reason ?? "Unauthorized" }, { status: 401 });
  }

  if (!isCronEnabled()) {
    return jsonResponse({
      ok: true,
      skipped: "RADAR_V2_CRON_ENABLED não setado",
      hint: "v1 legacy ainda gera briefs. Setar env var pra ativar v2 cron.",
      dry: auth.isDry,
    });
  }

  const sql = getCronSql();
  const today = new Date().toISOString().slice(0, 10);
  const t0 = Date.now();
  const detail: Array<{ slug: string; status: string; signals?: number }> = [];

  if (auth.isDry) {
    for (const niche of NICHES) {
      const signals = await collectSignals(sql, niche.id);
      detail.push({
        slug: niche.id,
        status: "would_generate",
        signals: signals.news.length + signals.ig.length,
      });
    }
    return jsonResponse({
      ok: true,
      dry: true,
      date: today,
      detail,
      duration_ms: Date.now() - t0,
    });
  }

  let totalOk = 0;
  let totalSkipped = 0;
  let totalErr = 0;

  for (const niche of NICHES) {
    const otherSlugs = NICHES.filter((n) => n.id !== niche.id).map((n) => n.id);
    try {
      // Skip se brief de hoje já existe (idempotência forte)
      const existing = (await sql`
        SELECT 1 FROM daily_briefs
         WHERE niche = ${niche.id} AND brief_date = ${today}::date
         LIMIT 1
      `) as Array<unknown>;
      if (existing.length > 0) {
        detail.push({ slug: niche.id, status: "already_exists" });
        totalSkipped++;
        continue;
      }

      const signals = await collectSignals(sql, niche.id);
      const total = signals.counts.news + signals.counts.ig;
      if (total < 3) {
        detail.push({ slug: niche.id, status: `skipped_${total}_signals` });
        totalSkipped++;
        continue;
      }

      const brief = await generateBrief(
        { id: niche.id, label: niche.label, description: niche.description },
        otherSlugs,
        signals,
      );
      if (!brief) {
        detail.push({ slug: niche.id, status: "gemini_failed" });
        totalErr++;
        await logCronRun(sql, {
          cronType: "brief",
          status: "error",
          errorMsg: `gemini_failed:${niche.id}`,
        });
        continue;
      }

      await sql`
        INSERT INTO daily_briefs (
          niche, brief_date, narratives, hot_topics, carousel_ideas,
          cross_pollination, source_counts, model_used, cost_usd
        ) VALUES (
          ${niche.id}, ${today}::date,
          ${JSON.stringify(brief.narratives ?? [])}::jsonb,
          ${JSON.stringify(brief.hot_topics ?? [])}::jsonb,
          ${JSON.stringify(brief.carousel_ideas ?? [])}::jsonb,
          ${JSON.stringify(brief.cross_pollination ?? [])}::jsonb,
          ${JSON.stringify(signals.counts)}::jsonb,
          'gemini-2.5-flash', 0.0001
        )
        ON CONFLICT (niche, brief_date) DO UPDATE SET
          narratives = EXCLUDED.narratives,
          hot_topics = EXCLUDED.hot_topics,
          carousel_ideas = EXCLUDED.carousel_ideas,
          cross_pollination = EXCLUDED.cross_pollination,
          source_counts = EXCLUDED.source_counts,
          generated_at = NOW()
      `;
      detail.push({
        slug: niche.id,
        status: `ok (${brief.narratives?.length ?? 0}n / ${brief.hot_topics?.length ?? 0}t / ${brief.carousel_ideas?.length ?? 0}i)`,
      });
      totalOk++;
      await logCronRun(sql, {
        cronType: "brief",
        postsAdded: 1,
        status: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      detail.push({ slug: niche.id, status: `error: ${msg.slice(0, 80)}` });
      totalErr++;
      await logCronRun(sql, {
        cronType: "brief",
        status: "error",
        errorMsg: msg.slice(0, 500),
      });
    }
  }

  return jsonResponse({
    ok: true,
    date: today,
    bundles: NICHES.length,
    ok_count: totalOk,
    skipped: totalSkipped,
    errors: totalErr,
    detail,
    duration_ms: Date.now() - t0,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
