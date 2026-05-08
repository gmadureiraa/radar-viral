/**
 * Fontes curadas por nicho — catálogo enxuto e premium.
 *
 * Estrutura: 3 fontes por plataforma × 5 plataformas (não-RSS) + RSS expandido
 * por nicho × 3 nichos.
 *  - 5 plataformas sociais × 3 fontes = 15 por nicho
 *  - RSS expandido (10-12 portais) por nicho — todos validados via curl
 *  - Total: ~80 fontes curadas (vs 54 antes)
 *
 * Plataformas: instagram, youtube, tiktok, threads, rss, newsletter.
 * Nichos: crypto, marketing, ai.
 *
 * RSS feeds validados em 2026-05-08 — todos retornam XML válido na época.
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
  // RSS Notícias (12 — validados 2026-05-08)
  // BR (4)
  { key: key("crypto", "rss", "livecoins"), niche: "crypto", platform: "rss", handle: "https://livecoins.com.br/feed/", label: "Livecoins", detail: "Bitcoin BR · maior portal", lang: "pt", externalUrl: "https://livecoins.com.br" },
  { key: key("crypto", "rss", "portaldobitcoin"), niche: "crypto", platform: "rss", handle: "https://portaldobitcoin.uol.com.br/feed/", label: "Portal do Bitcoin", detail: "UOL · cripto BR", lang: "pt", externalUrl: "https://portaldobitcoin.uol.com.br" },
  { key: key("crypto", "rss", "cointimes"), niche: "crypto", platform: "rss", handle: "https://cointimes.com.br/feed/", label: "Cointimes", detail: "Cripto BR independente", lang: "pt", externalUrl: "https://cointimes.com.br" },
  { key: key("crypto", "rss", "guiadobitcoin"), niche: "crypto", platform: "rss", handle: "https://guiadobitcoin.com.br/feed/", label: "Guia do Bitcoin", detail: "BTC educação BR", lang: "pt", externalUrl: "https://guiadobitcoin.com.br" },
  // EN (8)
  { key: key("crypto", "rss", "cointelegraph"), niche: "crypto", platform: "rss", handle: "https://cointelegraph.com/rss", label: "Cointelegraph", detail: "Maior portal cripto global", lang: "en", externalUrl: "https://cointelegraph.com" },
  { key: key("crypto", "rss", "coindesk"), niche: "crypto", platform: "rss", handle: "https://www.coindesk.com/arc/outboundfeeds/rss/", label: "CoinDesk", detail: "Notícia cripto referência EN", lang: "en", externalUrl: "https://www.coindesk.com" },
  { key: key("crypto", "rss", "decrypt"), niche: "crypto", platform: "rss", handle: "https://decrypt.co/feed", label: "Decrypt", detail: "Cripto + Web3 EN", lang: "en", externalUrl: "https://decrypt.co" },
  { key: key("crypto", "rss", "theblock"), niche: "crypto", platform: "rss", handle: "https://www.theblock.co/rss.xml", label: "The Block", detail: "Análise cripto institucional", lang: "en", externalUrl: "https://www.theblock.co" },
  { key: key("crypto", "rss", "blockworks"), niche: "crypto", platform: "rss", handle: "https://blockworks.co/feed", label: "Blockworks", detail: "Cripto institucional/macro", lang: "en", externalUrl: "https://blockworks.co" },
  { key: key("crypto", "rss", "thedefiant"), niche: "crypto", platform: "rss", handle: "https://thedefiant.io/api/feed", label: "The Defiant", detail: "DeFi profundo EN", lang: "en", externalUrl: "https://thedefiant.io" },
  { key: key("crypto", "rss", "bankless"), niche: "crypto", platform: "rss", handle: "https://bankless.com/feed", label: "Bankless", detail: "DeFi/Web3 community", lang: "en", externalUrl: "https://bankless.com" },
  { key: key("crypto", "rss", "bitcoinmagazine"), niche: "crypto", platform: "rss", handle: "https://bitcoinmagazine.com/.rss/full/", label: "Bitcoin Magazine", detail: "Bitcoin maximalist EN", lang: "en", externalUrl: "https://bitcoinmagazine.com" },
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
  // RSS Notícias (10 — validados 2026-05-08)
  // BR (5)
  { key: key("marketing", "rss", "meioemensagem"), niche: "marketing", platform: "rss", handle: "https://www.meioemensagem.com.br/feed", label: "Meio & Mensagem", detail: "Marketing BR · referência", lang: "pt", externalUrl: "https://www.meioemensagem.com.br" },
  { key: key("marketing", "rss", "propmark"), niche: "marketing", platform: "rss", handle: "https://propmark.com.br/feed/", label: "Propmark", detail: "Publicidade BR", lang: "pt", externalUrl: "https://propmark.com.br" },
  { key: key("marketing", "rss", "b9"), niche: "marketing", platform: "rss", handle: "https://www.b9.com.br/feed/", label: "B9", detail: "Marketing/cultura digital BR", lang: "pt", externalUrl: "https://www.b9.com.br" },
  { key: key("marketing", "rss", "adnews"), niche: "marketing", platform: "rss", handle: "https://www.adnews.com.br/feed/", label: "Adnews", detail: "Publicidade/agências BR", lang: "pt", externalUrl: "https://www.adnews.com.br" },
  { key: key("marketing", "rss", "exame"), niche: "marketing", platform: "rss", handle: "https://exame.com/feed/", label: "Exame", detail: "Negócios/marcas BR", lang: "pt", externalUrl: "https://exame.com" },
  // EN (5)
  { key: key("marketing", "rss", "searchengineland"), niche: "marketing", platform: "rss", handle: "https://searchengineland.com/feed", label: "Search Engine Land", detail: "SEO técnico", lang: "en", externalUrl: "https://searchengineland.com" },
  { key: key("marketing", "rss", "hubspot"), niche: "marketing", platform: "rss", handle: "https://blog.hubspot.com/marketing/rss.xml", label: "HubSpot Marketing", detail: "Inbound + content + automation", lang: "en", externalUrl: "https://blog.hubspot.com/marketing" },
  { key: key("marketing", "rss", "ahrefs"), niche: "marketing", platform: "rss", handle: "https://blog.ahrefs.com/feed/", label: "Ahrefs Blog", detail: "SEO orgânico técnico", lang: "en", externalUrl: "https://ahrefs.com/blog" },
  { key: key("marketing", "rss", "moz"), niche: "marketing", platform: "rss", handle: "https://moz.com/posts/rss/blog", label: "Moz", detail: "SEO + conteúdo", lang: "en", externalUrl: "https://moz.com/blog" },
  { key: key("marketing", "rss", "copyblogger"), niche: "marketing", platform: "rss", handle: "https://copyblogger.com/feed/", label: "Copyblogger", detail: "Copywriting + content", lang: "en", externalUrl: "https://copyblogger.com" },
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
  // RSS Notícias (12 — validados 2026-05-08)
  // BR / Tech (4)
  { key: key("ai", "rss", "olhardigital"), niche: "ai", platform: "rss", handle: "https://olhardigital.com.br/feed/", label: "Olhar Digital", detail: "Tech/IA BR mainstream", lang: "pt", externalUrl: "https://olhardigital.com.br" },
  { key: key("ai", "rss", "canaltech"), niche: "ai", platform: "rss", handle: "https://canaltech.com.br/rss/", label: "Canaltech", detail: "Tech BR · cobertura ampla", lang: "pt", externalUrl: "https://canaltech.com.br" },
  { key: key("ai", "rss", "tudocelular"), niche: "ai", platform: "rss", handle: "https://www.tudocelular.com/rss/", label: "TudoCelular", detail: "Tech mobile/IA BR", lang: "pt", externalUrl: "https://www.tudocelular.com" },
  { key: key("ai", "rss", "infomoney"), niche: "ai", platform: "rss", handle: "https://www.infomoney.com.br/feed/", label: "InfoMoney", detail: "Negócios/tech BR", lang: "pt", externalUrl: "https://www.infomoney.com.br" },
  // EN (8)
  { key: key("ai", "rss", "openai-news"), niche: "ai", platform: "rss", handle: "https://openai.com/news/rss.xml", label: "OpenAI News", detail: "Anúncios oficiais OpenAI", lang: "en", externalUrl: "https://openai.com/news" },
  { key: key("ai", "rss", "google-ai"), niche: "ai", platform: "rss", handle: "https://blog.google/technology/ai/rss/", label: "Google AI Blog", detail: "Pesquisa + Gemini + DeepMind", lang: "en", externalUrl: "https://blog.google/technology/ai" },
  { key: key("ai", "rss", "huggingface"), niche: "ai", platform: "rss", handle: "https://huggingface.co/blog/feed.xml", label: "Hugging Face Blog", detail: "Open source AI", lang: "en", externalUrl: "https://huggingface.co/blog" },
  { key: key("ai", "rss", "venturebeat-ai"), niche: "ai", platform: "rss", handle: "https://venturebeat.com/category/ai/feed/", label: "VentureBeat AI", detail: "Enterprise AI", lang: "en", externalUrl: "https://venturebeat.com/category/ai" },
  { key: key("ai", "rss", "techcrunch-ai"), niche: "ai", platform: "rss", handle: "https://techcrunch.com/category/artificial-intelligence/feed/", label: "TechCrunch AI", detail: "Startups + investimento AI", lang: "en", externalUrl: "https://techcrunch.com/category/artificial-intelligence" },
  { key: key("ai", "rss", "mit-techreview"), niche: "ai", platform: "rss", handle: "https://www.technologyreview.com/feed/", label: "MIT Technology Review", detail: "AI análise profunda", lang: "en", externalUrl: "https://www.technologyreview.com" },
  { key: key("ai", "rss", "marktechpost"), niche: "ai", platform: "rss", handle: "https://www.marktechpost.com/feed/", label: "MarkTechPost", detail: "Papers + modelos novos", lang: "en", externalUrl: "https://www.marktechpost.com" },
  { key: key("ai", "rss", "arstechnica-ai"), niche: "ai", platform: "rss", handle: "https://arstechnica.com/ai/feed/", label: "Ars Technica AI", detail: "Tech jornalismo profundo", lang: "en", externalUrl: "https://arstechnica.com/ai" },
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
