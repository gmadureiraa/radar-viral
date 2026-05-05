/**
 * Classificador heurístico de notícias.
 *
 * Separa "news" (atualizações concretas, lançamentos, anúncios, números
 * reais) de "analysis" (opinião, especulação, roundups, listicle).
 *
 * Por que heurística e não LLM: o ranking é hot-path (toda request da
 * dashboard chama). LLM custaria latência + $/token. Os padrões de
 * crypto/marketing/AI news são bem regulares e bate ~85% no eyeball test.
 *
 * Sinais positivos (news):
 *   - Verbos de fato: launches, raises, files, cuts, approves, hires
 *   - $ ou números absolutos no título (ex: "$2.2B", "14%")
 *   - Nomes próprios + ação ("X launches Y", "Y acquired by Z")
 *   - PT-BR equivalente: "anuncia", "lança", "compra", "demite"
 *
 * Sinais negativos (analysis/opinion):
 *   - Pergunta no título ("Sell now?", "Should you?", "Why X?")
 *   - "What to expect", "How to", "Top N", "X reasons"
 *   - "Day 1", "Roundup", "Recap", "Update", "performance update"
 *   - Termos especulativos: "could", "may", "predicts", "forecast"
 *   - PT-BR: "como", "porque", "vai", "previsão", "5 motivos"
 */

export type NewsKind = "news" | "analysis";

export interface ClassifyInput {
  title: string;
  description?: string | null;
  category?: string | null;
  source_name?: string | null;
}

export interface ClassifyResult {
  kind: NewsKind;
  score: number; // -100..100, > 0 = news
  signals: string[];
}

const NEWS_VERBS_EN = [
  /\b(launch(es|ed)?|launches|raises?|raised|cuts?|cut|fires?|fired|hires?|hired|acquires?|acquired|merges?|merged|files?|filed|approves?|approved|rejects?|rejected|sues?|sued|wins?|won|loses?|lost|buys?|bought|sells?|sold|signs?|signed|partners? with|appointed?|delists?|listed?|released|releases|announces|announced|reveals?|reveals|debuts?|debut|rolls? out|scraps?|moves? to|joins?|leaves?|exits?|steps? down|steps? in|to leave|to step down|hits?|surpasses?|tops?|breaks?|crosses?|reaches?|surges?|drops?|plunges?|slides?|rallies|jumps?|gains?|adds?|invests?|invested|backs?|backed|loses?|opens?|closes?|denies?|denied|seizes?|seized|halts?|halted|pauses?|paused|resumes?|resumed)\b/i,
];

const NEWS_VERBS_PT = [
  /\b(lança|lançou|anuncia|anunciou|compra|comprou|vende|vendeu|demite|demitiu|contrata|contratou|aprova|aprovou|rejeita|rejeitou|processa|processou|fecha parceria|investe|investiu|capta|captou|recebe|recebeu|levanta|levantou|firma|firmou|adquire|adquiriu)\b/i,
];

const NEWS_TITLE_PATTERNS = [
  // X launches Y
  /\b\w+\s+(launch(es|ed)?|raises?|cuts?|files?)\b/i,
  // Acordo numerico ($1B, $500M, 14%, 1.4 milhão)
  /\$\d|\b\d[\d,.]*\s?(million|billion|trillion|bilhão|bilhões|milhão|milhões|mi|bi|m|b)\b/i,
  /\b\d+%/,
  // SEC, Fed, Court, Senate, etc — nomes de instituições com ação
  /\b(SEC|CFTC|Fed|FOMC|FBI|DOJ|FTC|Treasury|White House|Senate|Congress|Court|EU|ECB|BCB|Banco Central|Receita Federal|CVM|STF)\b.*\b(approves?|rejects?|files?|sues?|fines?|aprova|rejeita|multa|investiga)\b/i,
];

const ANALYSIS_PATTERNS = [
  // Pergunta no título ("Sell now?", "Why X?")
  /\?$/,
  /^\s*(why|how|what|should|will|can|is|are|does|por que|porque|como|deve|deveria|vai|vão|pode|é|são)\b.*\?/i,
  // "What to expect", "How to", "5 reasons"
  /\b(what to expect|how to|reasons? (why|to)|things? (you|to)|tips?|guide|tutorial)\b/i,
  /^\s*\d+\s+(reasons?|things?|tips?|ways?|maneiras|motivos|coisas|formas)\b/i,
  // Roundups, day-by-day, performance updates
  /\b(roundup|recap|performance update|day \d+|sights? and sounds|weekly wrap|wrap-?up|highlights|recap)\b/i,
  // Opinião/especulação
  /\b(could|may|might|predicts?|forecast(s|ed)?|outlook|analyse?s?|analysis|opinion|predicts|opina|análise|previsão|prevê|aposta|deve|pode chegar)\b/i,
  // Title patterns "X vs Y", "supercycle or bear-market rally"
  /\b(or)\b.+\?$/i,
];

export function classifyNewsArticle(input: ClassifyInput): ClassifyResult {
  const title = (input.title ?? "").trim();
  const desc = (input.description ?? "").trim();
  const haystack = `${title} ${desc}`;

  let score = 0;
  const signals: string[] = [];

  // Sinais positivos
  for (const re of NEWS_VERBS_EN) {
    if (re.test(haystack)) {
      score += 15;
      signals.push("verb-en");
      break;
    }
  }
  for (const re of NEWS_VERBS_PT) {
    if (re.test(haystack)) {
      score += 15;
      signals.push("verb-pt");
      break;
    }
  }
  for (const re of NEWS_TITLE_PATTERNS) {
    if (re.test(title)) {
      score += 12;
      signals.push("news-pattern");
    }
  }

  // Sinais negativos — pesam mais (queremos cortar opinião agressivamente)
  for (const re of ANALYSIS_PATTERNS) {
    if (re.test(title)) {
      score -= 25;
      signals.push("analysis-pattern");
    }
  }

  // Heurísticas adicionais
  // Title todo em CAPS BR (clickbait): "CUIDADO COM ESSE MOVIMENTO" → analysis
  const allCapsRatio = (title.match(/[A-ZÁÉÍÓÚÂÊÔÃÕ]/g) ?? []).length / Math.max(1, title.length);
  if (allCapsRatio > 0.6 && title.length > 20) {
    score -= 20;
    signals.push("all-caps");
  }

  // Title curto + verbo de ação no início → forte sinal de news
  const firstWord = title.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (
    [
      "bitcoin",
      "ethereum",
      "binance",
      "coinbase",
      "sec",
      "fed",
      "trump",
      "biden",
      "musk",
      "google",
      "apple",
      "microsoft",
      "openai",
      "anthropic",
    ].includes(firstWord)
  ) {
    score += 5;
    signals.push("starts-named-entity");
  }

  // Source-level adjustment: alguns canais são quase 100% opinião
  const opinionSources = ["BeInCrypto Analysis", "CoinDesk Markets", "Bankless"];
  if (opinionSources.includes(input.source_name ?? "")) {
    score -= 10;
    signals.push("opinion-source");
  }

  // Threshold inclusivo: score >= 0 → news (queremos default agressivo
  // pro lado das notícias; só corta o que claramente é análise/opinião).
  return {
    kind: score >= 0 ? "news" : "analysis",
    score,
    signals,
  };
}
