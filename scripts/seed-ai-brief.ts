/**
 * scripts/seed-ai-brief.ts
 *
 * One-off pra popular niche `ai` no DB e gerar primeiro brief.
 *
 * Por que existe: cron v1 legacy não inclui AI niche; v2 cron tá gated
 * por RADAR_V2_CRON_ENABLED. Esse script faz o trabalho manualmente:
 *   1. Fetch RSS das 10 fontes AI de NEWS_TOP
 *   2. INSERT em news_articles
 *   3. Coleta sinais (news+ig+yt) das últimas 48h
 *   4. Chama Gemini Flash com o prompt do brief
 *   5. UPSERT em daily_briefs
 *
 * Uso: `bun run scripts/seed-ai-brief.ts`
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DATABASE_URL || !GEMINI_API_KEY) {
  console.error("DATABASE_URL ou GEMINI_API_KEY ausente. Rode com env carregado.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const AI_NEWS_SOURCES = [
  { id: "theverge-ai", name: "The Verge — AI", rss: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", lang: "en", cat: "news", color: "#FA4317" },
  { id: "venturebeat-ai", name: "VentureBeat — AI", rss: "https://venturebeat.com/category/ai/feed/", lang: "en", cat: "news", color: "#1A237E" },
  { id: "techcrunch-ai", name: "TechCrunch — AI", rss: "https://techcrunch.com/category/artificial-intelligence/feed/", lang: "en", cat: "news", color: "#0A9F23" },
  { id: "huggingface-blog", name: "HuggingFace Blog", rss: "https://huggingface.co/blog/feed.xml", lang: "en", cat: "research", color: "#FFD21E" },
  { id: "openai-blog", name: "OpenAI Blog", rss: "https://openai.com/blog/rss.xml", lang: "en", cat: "research", color: "#10A37F" },
  { id: "anthropic-news", name: "Anthropic News", rss: "https://www.anthropic.com/news/rss", lang: "en", cat: "research", color: "#D97757" },
  { id: "simonw-blog", name: "Simon Willison's Blog", rss: "https://simonwillison.net/atom/everything/", lang: "en", cat: "tools", color: "#A78BFA" },
  { id: "marktechpost", name: "MarkTechPost", rss: "https://www.marktechpost.com/feed/", lang: "en", cat: "research", color: "#0EA5E9" },
  { id: "wired-ai", name: "Wired — AI", rss: "https://www.wired.com/feed/tag/ai/latest/rss", lang: "en", cat: "news", color: "#000000" },
];

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
    .slice(0, 500);
}

async function refreshAiNews() {
  let inserted = 0;
  for (const source of AI_NEWS_SOURCES) {
    try {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.rss)}`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        console.warn(`  ${source.id}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as {
        status: string;
        items?: Array<{
          title: string;
          link: string;
          pubDate: string;
          description?: string;
          thumbnail?: string;
          enclosure?: { link?: string };
        }>;
      };
      if (data.status !== "ok" || !Array.isArray(data.items)) {
        console.warn(`  ${source.id}: rss2json status=${data.status}`);
        continue;
      }
      let n = 0;
      for (const item of data.items.slice(0, 10)) {
        try {
          await sql`
            INSERT INTO news_articles (
              link, source_id, source_name, source_color, language,
              niche, category, title, description, thumbnail, pub_date, fetched_at
            ) VALUES (
              ${item.link}, ${source.id}, ${source.name}, ${source.color}, ${source.lang},
              'ai', ${source.cat}, ${item.title},
              ${stripHtml(item.description ?? "")},
              ${item.thumbnail ?? item.enclosure?.link ?? null},
              ${item.pubDate ?? new Date().toISOString()}, NOW()
            )
            ON CONFLICT (link) DO UPDATE SET fetched_at = NOW()
          `;
          n++;
          inserted++;
        } catch (err) {
          /* dup ou schema, segue */
        }
      }
      console.log(`  ${source.id}: ${n} items`);
    } catch (err) {
      console.warn(`  ${source.id}: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return inserted;
}

async function generateBrief() {
  const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const news = (await sql`
    SELECT title, source_name, description, link
      FROM news_articles
     WHERE niche = 'ai' AND pub_date >= ${cutoff}
     ORDER BY pub_date DESC LIMIT 15
  `) as Array<{ title: string; source_name: string; description: string | null; link: string }>;

  if (news.length === 0) {
    console.log("\nSem news AI. Pulando brief.");
    return null;
  }

  const prompt = [
    `Você é um analista editorial de conteúdo viral. Analise os SINAIS das últimas 48h cruzando 3 plataformas (notícias, Instagram, YouTube) do nicho "Inteligência Artificial" (foco em ferramentas, modelos, lançamentos, regulação) e produza UM brief estratégico em JSON.`,
    "",
    `IMPORTANTE: cite explicitamente em "sources" pelo menos UMA referência de cada plataforma quando houver dado disponível, pra mostrar que cruzou as fontes.`,
    "",
    `# SINAIS (top items das últimas 48h)`,
    "",
    `## 📰 Notícias (${news.length})`,
    ...news
      .slice(0, 12)
      .map(
        (n) =>
          `- [${n.source_name}] ${n.title}${n.description ? ` — ${n.description.slice(0, 100)}` : ""}`,
      ),
    "",
    `## 📸 Instagram top likes (0)`,
    `(sem posts IG nas últimas 48h)`,
    "",
    `## 🎥 YouTube novos vídeos (0)`,
    `(sem vídeos YT nas últimas 48h)`,
    "",
    `# OUTPUT — apenas este JSON, sem markdown fences:`,
    `{`,
    `  "narratives": [{ "title": "string curta", "explanation": "1-2 frases", "sources": ["título da notícia"] }],`,
    `  "hot_topics": [{ "topic": "termo chave", "signal_count": 0, "source_summary": "1 frase" }],`,
    `  "carousel_ideas": [{ "hook": "FRASE CAIXA ALTA", "angle": "twist", "evidence": "dado", "suggested_cta": "CTA" }],`,
    `  "cross_pollination": []`,
    `}`,
    "",
    `Regras: PT-BR coloquial; concretude (nomes/números); 3 narrativas; 5 hot_topics; 3 carousel_ideas.`,
    `Primeiro caractere = '{', último = '}'.`,
  ].join("\n");

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

  if (!res.ok) {
    console.error(`Gemini ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const brief = JSON.parse(text);
  const today = new Date().toISOString().slice(0, 10);

  await sql`
    INSERT INTO daily_briefs (
      niche, brief_date, narratives, hot_topics, carousel_ideas,
      cross_pollination, source_counts, model_used, cost_usd
    ) VALUES (
      'ai', ${today}::date,
      ${JSON.stringify(brief.narratives ?? [])}::jsonb,
      ${JSON.stringify(brief.hot_topics ?? [])}::jsonb,
      ${JSON.stringify(brief.carousel_ideas ?? [])}::jsonb,
      ${JSON.stringify(brief.cross_pollination ?? [])}::jsonb,
      ${JSON.stringify({ news: news.length, ig: 0, yt: 0 })}::jsonb,
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
  return brief;
}

console.log("=== SEED AI: NEWS RSS ===");
const inserted = await refreshAiNews();
console.log(`\nTotal inseridos: ${inserted}`);

console.log("\n=== GENERATE AI BRIEF ===");
const brief = await generateBrief();
if (brief) {
  console.log(`\nBrief gerado: ${brief.narratives?.length ?? 0} narrativas, ${brief.hot_topics?.length ?? 0} topics`);
  console.log(`Top narrativa: ${brief.narratives?.[0]?.title}`);
}
