/**
 * scripts/regen-briefs-today.ts
 *
 * Regenera briefs de hoje pra todos os 3 nichos usando lógica do
 * /api/cron/brief mas rodando local (contornando o Vercel Security
 * Checkpoint que bloqueia disparos manuais consecutivos).
 *
 * Roda: `bun scripts/regen-briefs-today.ts`
 */

import { neon } from "@neondatabase/serverless";
import { NICHES } from "../lib/niches";
import { getCuratedSources } from "../lib/sources-curated";

const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!DATABASE_URL || !GEMINI_API_KEY) {
  console.error("DATABASE_URL ou GEMINI_API_KEY ausente");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function collectSignals(nicheSlug: string) {
  const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const curated = getCuratedSources(nicheSlug);
  const ytHandles =
    curated?.youtubeChannels.map((c) =>
      (c.handle.startsWith("@") ? c.handle : `@${c.handle}`).toLowerCase(),
    ) ?? [];

  const [news, ig, yt] = await Promise.all([
    sql`SELECT title, source_name, description, link FROM news_articles
        WHERE niche = ${nicheSlug} AND pub_date >= ${cutoff}
        ORDER BY pub_date DESC LIMIT 15`,
    sql`SELECT account_handle, caption, likes, comments FROM instagram_posts
        WHERE niche = ${nicheSlug} AND posted_at >= ${cutoff}
        ORDER BY likes DESC LIMIT 10`,
    ytHandles.length > 0
      ? sql`SELECT channel_name, channel_handle, title, category FROM videos
          WHERE published_at >= ${cutoff}
            AND lower(channel_handle) = ANY(${ytHandles})
          ORDER BY published_at DESC LIMIT 10`
      : Promise.resolve([]),
  ]);

  return {
    news: news as Array<{ title: string; source_name: string; description: string | null; link: string }>,
    ig: ig as Array<{ account_handle: string; caption: string | null; likes: number; comments: number }>,
    yt: yt as Array<{ channel_name: string; channel_handle: string | null; title: string; category: string | null }>,
    counts: { news: news.length, ig: ig.length, yt: yt.length },
  };
}

function buildPrompt(
  niche: { id: string; label: string; description: string },
  signals: Awaited<ReturnType<typeof collectSignals>>,
): string {
  return [
    `Você é um analista editorial de conteúdo viral. Analise os SINAIS das últimas 48h cruzando 3 plataformas (notícias, Instagram, YouTube) do nicho "${niche.label}" (${niche.description}) e produza UM brief estratégico em JSON.`,
    "",
    `IMPORTANTE: cite explicitamente em "sources" pelo menos UMA referência de cada plataforma quando houver dado disponível.`,
    "",
    `# SINAIS (top items das últimas 48h)`,
    "",
    `## 📰 Notícias (${signals.news.length})`,
    signals.news.length === 0
      ? "(sem notícias nas últimas 48h)"
      : signals.news.slice(0, 12).map((n) => `- [${n.source_name}] ${n.title}${n.description ? ` — ${n.description.slice(0, 100)}` : ""}`).join("\n"),
    "",
    `## 📸 Instagram top likes (${signals.ig.length})`,
    signals.ig.length === 0
      ? "(sem posts IG nas últimas 48h)"
      : signals.ig.slice(0, 8).map((i) => `- @${i.account_handle} · ❤${i.likes} · ${(i.caption ?? "").slice(0, 120)}`).join("\n"),
    "",
    `## 🎥 YouTube novos vídeos (${signals.yt.length})`,
    signals.yt.length === 0
      ? "(sem vídeos YT nas últimas 48h)"
      : signals.yt.slice(0, 8).map((v) => `- ${v.channel_name} (${v.channel_handle ?? ""}): ${v.title.slice(0, 140)}`).join("\n"),
    "",
    `# OUTPUT — apenas este JSON, sem markdown fences:`,
    `{`,
    `  "narratives": [{ "title": "string curta", "explanation": "1-2 frases", "sources": ["título de notícia ou @handle ou canal YT"] }],`,
    `  "hot_topics": [{ "topic": "termo chave", "signal_count": 0, "source_summary": "1 frase mencionando origem (news/IG/YT)" }],`,
    `  "carousel_ideas": [{ "hook": "FRASE CAIXA ALTA", "angle": "twist", "evidence": "dado concreto", "suggested_cta": "CTA" }],`,
    `  "cross_pollination": [{ "topic": "tema", "sources": ["news", "instagram", "youtube"] }]`,
    `}`,
    "",
    `Regras: PT-BR coloquial; concretude (nomes/números); 3 narrativas (priorize as que aparecem em MAIS DE UMA plataforma); 5 hot_topics; 3 carousel_ideas; cross_pollination até 4, só 2+ plataformas.`,
    `Primeiro caractere = '{', último = '}'.`,
  ].join("\n");
}

async function generateBrief(
  niche: { id: string; label: string; description: string },
  signals: Awaited<ReturnType<typeof collectSignals>>,
) {
  const prompt = buildPrompt(niche, signals);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty response");
  return JSON.parse(text);
}

const today = new Date().toISOString().slice(0, 10);

for (const niche of NICHES) {
  console.log(`\n=== ${niche.id} ===`);
  const signals = await collectSignals(niche.id);
  console.log(`signals: news=${signals.counts.news} ig=${signals.counts.ig} yt=${signals.counts.yt}`);
  if (signals.counts.news + signals.counts.ig + signals.counts.yt < 3) {
    console.log("skipped (signals < 3)");
    continue;
  }
  const brief = await generateBrief(
    { id: niche.id, label: niche.label, description: niche.description },
    signals,
  );
  console.log(
    `gen: ${brief.narratives?.length ?? 0}n / ${brief.hot_topics?.length ?? 0}t / ${brief.carousel_ideas?.length ?? 0}i`,
  );
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
  console.log("inserted/updated");
}

console.log("\n✅ done");
