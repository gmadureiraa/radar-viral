/**
 * Fontes curadas por nicho — catálogo enxuto e premium.
 *
 * Estrutura: 3 fontes por plataforma × 6 plataformas × 3 nichos = 54 fontes.
 *
 * Plataformas: instagram, youtube, tiktok, threads, rss, newsletter.
 * Nichos: crypto, marketing, ai.
 *
 * Comportamento:
 *  - Todo user vê o catálogo na UI (Free e Pro).
 *  - Cron individual usa essas fontes APENAS pra users sem fontes próprias
 *    OU como complemento (ler `disabled_curated_sources` pra filtrar).
 *  - User pode desativar curadas individualmente (não vão pro cron dele).
 *
 * IMPORTANT: cada item tem `key` único (curated:<niche>:<platform>:<handle>)
 * pra permitir toggle on/off por user.
 */

export type CuratedNiche = "crypto" | "marketing" | "ai";
export type CuratedPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "threads"
  | "rss"
  | "newsletter";

export interface CuratedSource {
  /** Identificador único cross-renderização — usado pra toggle on/off. */
  key: string;
  niche: CuratedNiche;
  platform: CuratedPlatform;
  /** Handle/identifier no formato esperado pelo scraper. */
  handle: string;
  /** Nome amigável pro display. */
  label: string;
  /** Sub-info opcional (followers, idioma, descrição curta). */
  detail?: string;
  /** URL canônica externa (perfil/canal/feed). */
  externalUrl?: string;
  /** YT channelId UC... pra RSS scrape direto. */
  channelId?: string;
  /** Linguagem (RSS/newsletter): pt/en. */
  lang?: "pt" | "en";
  /** Email do remetente (newsletter). */
  sender?: string;
}

function key(niche: CuratedNiche, platform: CuratedPlatform, handle: string): string {
  return `curated:${niche}:${platform}:${handle.replace(/^@/, "").toLowerCase()}`;
}

// ─── CRYPTO ────────────────────────────────────────────────────────────

const CRYPTO: CuratedSource[] = [
  // Instagram (3)
  { key: key("crypto", "instagram", "investidor4.20"), niche: "crypto", platform: "instagram", handle: "investidor4.20", label: "Lucas Amendola", detail: "Bitcoin BR · 300k+", externalUrl: "https://instagram.com/investidor4.20" },
  { key: key("crypto", "instagram", "augusto.backes"), niche: "crypto", platform: "instagram", handle: "augusto.backes", label: "Augusto Backes", detail: "Cripto fundamento", externalUrl: "https://instagram.com/augusto.backes" },
  { key: key("crypto", "instagram", "mercadobitcoin"), niche: "crypto", platform: "instagram", handle: "mercadobitcoin", label: "Mercado Bitcoin", detail: "Exchange BR", externalUrl: "https://instagram.com/mercadobitcoin" },
  // YouTube (3)
  { key: key("crypto", "youtube", "@CoinBureau"), niche: "crypto", platform: "youtube", handle: "@CoinBureau", channelId: "UCqK_GSMbpiV8spgD3ZGloSw", label: "Coin Bureau", detail: "Análises EN", externalUrl: "https://youtube.com/@CoinBureau" },
  { key: key("crypto", "youtube", "@Bankless"), niche: "crypto", platform: "youtube", handle: "@Bankless", channelId: "UCAl9Ld79qaZxp9JzEOwd3aA", label: "Bankless", detail: "DeFi/web3", externalUrl: "https://youtube.com/@Bankless" },
  { key: key("crypto", "youtube", "@Investidor4.20"), niche: "crypto", platform: "youtube", handle: "@Investidor4.20", channelId: "UC8oofAsuieQv3imZGvaUDOQ", label: "Investidor 4.20", detail: "Lucas Amendola BR", externalUrl: "https://youtube.com/@Investidor4.20" },
  // TikTok (3)
  { key: key("crypto", "tiktok", "investidor4.20"), niche: "crypto", platform: "tiktok", handle: "investidor4.20", label: "Lucas Amendola", detail: "Bitcoin clipes", externalUrl: "https://tiktok.com/@investidor4.20" },
  { key: key("crypto", "tiktok", "augustobackes"), niche: "crypto", platform: "tiktok", handle: "augustobackes", label: "Augusto Backes", externalUrl: "https://tiktok.com/@augustobackes" },
  { key: key("crypto", "tiktok", "coinbureau"), niche: "crypto", platform: "tiktok", handle: "coinbureau", label: "Coin Bureau", externalUrl: "https://tiktok.com/@coinbureau" },
  // Threads (3)
  { key: key("crypto", "threads", "vitalik.eth"), niche: "crypto", platform: "threads", handle: "vitalik.eth", label: "Vitalik Buterin", detail: "Co-founder Ethereum", externalUrl: "https://threads.net/@vitalik.eth" },
  { key: key("crypto", "threads", "balajis"), niche: "crypto", platform: "threads", handle: "balajis", label: "Balaji Srinivasan", detail: "Crypto contrarian", externalUrl: "https://threads.net/@balajis" },
  { key: key("crypto", "threads", "documentingbtc"), niche: "crypto", platform: "threads", handle: "documentingbtc", label: "Documenting Bitcoin", externalUrl: "https://threads.net/@documentingbtc" },
  // RSS Notícias (3)
  { key: key("crypto", "rss", "portaldobitcoin"), niche: "crypto", platform: "rss", handle: "https://portaldobitcoin.uol.com.br/feed/", label: "Portal do Bitcoin", lang: "pt", externalUrl: "https://portaldobitcoin.uol.com.br" },
  { key: key("crypto", "rss", "coindesk"), niche: "crypto", platform: "rss", handle: "https://www.coindesk.com/arc/outboundfeeds/rss/", label: "CoinDesk", lang: "en", externalUrl: "https://www.coindesk.com" },
  { key: key("crypto", "rss", "bitcoinmagazine"), niche: "crypto", platform: "rss", handle: "https://bitcoinmagazine.com/.rss/full/", label: "Bitcoin Magazine", lang: "en", externalUrl: "https://bitcoinmagazine.com" },
  // Newsletter (3)
  { key: key("crypto", "newsletter", "defiverso"), niche: "crypto", platform: "newsletter", handle: "lucas@defiverso.com.br", label: "Resumo Criptoverso", detail: "Defiverso · Lucas Amendola", sender: "lucas@defiverso.com.br", externalUrl: "https://defiverso.kaleidos.com.br/newsletter" },
  { key: key("crypto", "newsletter", "bankless"), niche: "crypto", platform: "newsletter", handle: "newsletter@bankless.com", label: "Bankless", detail: "DeFi/web3 EN", sender: "newsletter@bankless.com", externalUrl: "https://www.bankless.com/" },
  { key: key("crypto", "newsletter", "milkroad"), niche: "crypto", platform: "newsletter", handle: "kyle@milkroad.com", label: "Milk Road", detail: "Daily crypto EN", sender: "kyle@milkroad.com", externalUrl: "https://milkroad.com/" },
];

// ─── MARKETING ─────────────────────────────────────────────────────────

const MARKETING: CuratedSource[] = [
  // Instagram (3)
  { key: key("marketing", "instagram", "hormozi"), niche: "marketing", platform: "instagram", handle: "hormozi", label: "Alex Hormozi", detail: "Business · 2M+", externalUrl: "https://instagram.com/hormozi" },
  { key: key("marketing", "instagram", "garyvee"), niche: "marketing", platform: "instagram", handle: "garyvee", label: "Gary Vaynerchuk", detail: "Marketing icon", externalUrl: "https://instagram.com/garyvee" },
  { key: key("marketing", "instagram", "ogmadureira"), niche: "marketing", platform: "instagram", handle: "ogmadureira", label: "Gabriel Madureira", detail: "Marketing/IA BR", externalUrl: "https://instagram.com/ogmadureira" },
  // YouTube (3)
  { key: key("marketing", "youtube", "@AlexHormozi"), niche: "marketing", platform: "youtube", handle: "@AlexHormozi", channelId: "UCUyDOdBWhC1MCxEjC46d-zw", label: "Alex Hormozi", detail: "Business EN", externalUrl: "https://youtube.com/@AlexHormozi" },
  { key: key("marketing", "youtube", "@AhrefsCom"), niche: "marketing", platform: "youtube", handle: "@AhrefsCom", channelId: "UCWquNQV8Y0_defMKnGKrFOQ", label: "Ahrefs", detail: "SEO técnico", externalUrl: "https://youtube.com/@AhrefsCom" },
  { key: key("marketing", "youtube", "@neilpatel"), niche: "marketing", platform: "youtube", handle: "@neilpatel", channelId: "UCl-Zrl0QhF66lu1aGXaTbfw", label: "Neil Patel", detail: "Growth/SEO", externalUrl: "https://youtube.com/@neilpatel" },
  // TikTok (3)
  { key: key("marketing", "tiktok", "hormozi"), niche: "marketing", platform: "tiktok", handle: "hormozi", label: "Alex Hormozi", detail: "Business clipes", externalUrl: "https://tiktok.com/@hormozi" },
  { key: key("marketing", "tiktok", "garyvee"), niche: "marketing", platform: "tiktok", handle: "garyvee", label: "Gary Vaynerchuk", externalUrl: "https://tiktok.com/@garyvee" },
  { key: key("marketing", "tiktok", "ogmadureira"), niche: "marketing", platform: "tiktok", handle: "ogmadureira", label: "Gabriel Madureira", externalUrl: "https://tiktok.com/@ogmadureira" },
  // Threads (3)
  { key: key("marketing", "threads", "hormozi"), niche: "marketing", platform: "threads", handle: "hormozi", label: "Alex Hormozi", externalUrl: "https://threads.net/@hormozi" },
  { key: key("marketing", "threads", "garyvee"), niche: "marketing", platform: "threads", handle: "garyvee", label: "Gary Vaynerchuk", externalUrl: "https://threads.net/@garyvee" },
  { key: key("marketing", "threads", "thejustinwelsh"), niche: "marketing", platform: "threads", handle: "thejustinwelsh", label: "Justin Welsh", detail: "Solopreneur", externalUrl: "https://threads.net/@thejustinwelsh" },
  // RSS Notícias (3)
  { key: key("marketing", "rss", "marketingbrew"), niche: "marketing", platform: "rss", handle: "https://www.marketingbrew.com/feed", label: "Marketing Brew", lang: "en", externalUrl: "https://www.marketingbrew.com" },
  { key: key("marketing", "rss", "searchengineland"), niche: "marketing", platform: "rss", handle: "https://searchengineland.com/feed", label: "Search Engine Land", lang: "en", externalUrl: "https://searchengineland.com" },
  { key: key("marketing", "rss", "meioemensagem"), niche: "marketing", platform: "rss", handle: "https://www.meioemensagem.com.br/feed", label: "Meio & Mensagem", lang: "pt", externalUrl: "https://www.meioemensagem.com.br" },
  // Newsletter (3)
  { key: key("marketing", "newsletter", "marketingbrew"), niche: "marketing", platform: "newsletter", handle: "newsletter@morningbrew.com", label: "Marketing Brew", detail: "Daily digest EN", sender: "newsletter@morningbrew.com", externalUrl: "https://www.marketingbrew.com/subscribe" },
  { key: key("marketing", "newsletter", "demandcurve"), niche: "marketing", platform: "newsletter", handle: "founders@demandcurve.com", label: "Demand Curve", detail: "Growth founders", sender: "founders@demandcurve.com", externalUrl: "https://demandcurve.com/newsletter" },
  { key: key("marketing", "newsletter", "whywebuy"), niche: "marketing", platform: "newsletter", handle: "katelyn@whywebuy.co", label: "Why We Buy", detail: "Katelyn Bourgoin · psicologia", sender: "katelyn@whywebuy.co", externalUrl: "https://whywebuy.beehiiv.com/" },
];

// ─── AI ────────────────────────────────────────────────────────────────

const AI: CuratedSource[] = [
  // Instagram (3)
  { key: key("ai", "instagram", "openai"), niche: "ai", platform: "instagram", handle: "openai", label: "OpenAI", detail: "ChatGPT/GPT", externalUrl: "https://instagram.com/openai" },
  { key: key("ai", "instagram", "anthropicai"), niche: "ai", platform: "instagram", handle: "anthropicai", label: "Anthropic", detail: "Claude/safety", externalUrl: "https://instagram.com/anthropicai" },
  { key: key("ai", "instagram", "huggingface"), niche: "ai", platform: "instagram", handle: "huggingface", label: "Hugging Face", detail: "Open source AI", externalUrl: "https://instagram.com/huggingface" },
  // YouTube (3)
  { key: key("ai", "youtube", "@matthew_berman"), niche: "ai", platform: "youtube", handle: "@matthew_berman", channelId: "UCawZsQWqfGSbCI5yjkdVkTA", label: "Matthew Berman", detail: "Daily AI updates", externalUrl: "https://youtube.com/@matthew_berman" },
  { key: key("ai", "youtube", "@aiexplained-official"), niche: "ai", platform: "youtube", handle: "@aiexplained-official", channelId: "UCNJ1Ymd5yFuUPtn21xtRbbw", label: "AI Explained", detail: "Análises profundas", externalUrl: "https://youtube.com/@aiexplained-official" },
  { key: key("ai", "youtube", "@mreflow"), niche: "ai", platform: "youtube", handle: "@mreflow", channelId: "UChpleBmo18P08aKCIgti38g", label: "Matt Wolfe", detail: "Weekly roundup", externalUrl: "https://youtube.com/@mreflow" },
  // TikTok (3)
  { key: key("ai", "tiktok", "openai"), niche: "ai", platform: "tiktok", handle: "openai", label: "OpenAI", externalUrl: "https://tiktok.com/@openai" },
  { key: key("ai", "tiktok", "perplexity.ai"), niche: "ai", platform: "tiktok", handle: "perplexity.ai", label: "Perplexity", externalUrl: "https://tiktok.com/@perplexity.ai" },
  { key: key("ai", "tiktok", "anthropic"), niche: "ai", platform: "tiktok", handle: "anthropic", label: "Anthropic", externalUrl: "https://tiktok.com/@anthropic" },
  // Threads (3)
  { key: key("ai", "threads", "openai"), niche: "ai", platform: "threads", handle: "openai", label: "OpenAI", externalUrl: "https://threads.net/@openai" },
  { key: key("ai", "threads", "anthropicai"), niche: "ai", platform: "threads", handle: "anthropicai", label: "Anthropic", externalUrl: "https://threads.net/@anthropicai" },
  { key: key("ai", "threads", "perplexity.ai"), niche: "ai", platform: "threads", handle: "perplexity.ai", label: "Perplexity", externalUrl: "https://threads.net/@perplexity.ai" },
  // RSS Notícias (3)
  { key: key("ai", "rss", "anthropic-news"), niche: "ai", platform: "rss", handle: "https://www.anthropic.com/news/rss", label: "Anthropic News", lang: "en", externalUrl: "https://www.anthropic.com/news" },
  { key: key("ai", "rss", "openai-blog"), niche: "ai", platform: "rss", handle: "https://openai.com/blog/rss.xml", label: "OpenAI Blog", lang: "en", externalUrl: "https://openai.com/blog" },
  { key: key("ai", "rss", "venturebeat-ai"), niche: "ai", platform: "rss", handle: "https://venturebeat.com/category/ai/feed/", label: "VentureBeat AI", lang: "en", externalUrl: "https://venturebeat.com/category/ai" },
  // Newsletter (3)
  { key: key("ai", "newsletter", "rundown"), niche: "ai", platform: "newsletter", handle: "rundown@therundown.ai", label: "The Rundown AI", detail: "Daily AI digest", sender: "rundown@therundown.ai", externalUrl: "https://www.therundown.ai/" },
  { key: key("ai", "newsletter", "tldr-ai"), niche: "ai", platform: "newsletter", handle: "ai@tldr.tech", label: "TLDR AI", detail: "5-min daily", sender: "ai@tldr.tech", externalUrl: "https://tldr.tech/ai" },
  { key: key("ai", "newsletter", "bensbites"), niche: "ai", platform: "newsletter", handle: "ben@bensbites.com", label: "Ben's Bites", detail: "AI news + tools", sender: "ben@bensbites.com", externalUrl: "https://bensbites.com/" },
];

// ─── Lookup ────────────────────────────────────────────────────────────

export const ALL_CURATED: CuratedSource[] = [...CRYPTO, ...MARKETING, ...AI];

export function getCuratedSourcesByNiche(niche: CuratedNiche): CuratedSource[] {
  return ALL_CURATED.filter((s) => s.niche === niche);
}

export function getCuratedByPlatform(
  niche: CuratedNiche,
  platform: CuratedPlatform,
): CuratedSource[] {
  return ALL_CURATED.filter((s) => s.niche === niche && s.platform === platform);
}

// ─── Backward-compat: shape antiga usada em /app/_components/* e brief ──
// Mantém legado funcionando enquanto novas tabs leem `getCuratedSourcesByNiche`.

export interface CuratedSourcesLegacy {
  niche: string;
  igHandles: Array<{ handle: string; label: string; followers?: string }>;
  youtubeChannels: Array<{ channelId?: string; handle: string; label: string; rssUrl?: string }>;
  newsRss: Array<{ name: string; url: string; lang: "pt" | "en" }>;
  newsletterSubscribe: Array<{ name: string; subscribeUrl: string; sender?: string }>;
}

export function getCuratedSources(nicheId: string): CuratedSourcesLegacy | null {
  if (nicheId !== "crypto" && nicheId !== "marketing" && nicheId !== "ai") return null;
  const niche = nicheId as CuratedNiche;
  return {
    niche,
    igHandles: getCuratedByPlatform(niche, "instagram").map((s) => ({
      handle: s.handle,
      label: s.label,
      followers: s.detail,
    })),
    youtubeChannels: getCuratedByPlatform(niche, "youtube").map((s) => ({
      handle: s.handle,
      label: s.label,
      channelId: s.channelId,
    })),
    newsRss: getCuratedByPlatform(niche, "rss").map((s) => ({
      name: s.label,
      url: s.handle,
      lang: s.lang ?? "en",
    })),
    newsletterSubscribe: getCuratedByPlatform(niche, "newsletter").map((s) => ({
      name: s.label,
      subscribeUrl: s.externalUrl ?? "#",
      sender: s.sender,
    })),
  };
}
