/**
 * Fontes curadas por nicho — pré-cadastradas pra todo user que pagar.
 *
 * IMPORTANTE: estes dados são apenas o catálogo. NÃO são populados
 * automaticamente em `tracked_sources`. Quando o user pagar (paywall
 * futuro), uma rotina copia essas listas pra `tracked_sources` com
 * `user_id = <user>` e o cron passa a popular DB pra esse user.
 *
 * Pra economia: free user vê apenas dados globais (sem cron próprio);
 * pago dispara cron individual.
 *
 * Estrutura por nicho × 4 categorias:
 *  - igHandles[]: contas IG mais relevantes do nicho
 *  - youtubeChannels[]: canais YT mais relevantes
 *  - newsRss[]: feeds RSS de portais
 *  - newsletterSubscribe[]: links pra user se inscrever em newsletters
 */

export interface CuratedSources {
  niche: string; // crypto / marketing / ai
  igHandles: Array<{ handle: string; label: string; followers?: string }>;
  youtubeChannels: Array<{
    channelId?: string;
    handle: string;
    label: string;
    rssUrl?: string;
  }>;
  newsRss: Array<{ name: string; url: string; lang: "pt" | "en" }>;
  newsletterSubscribe: Array<{ name: string; subscribeUrl: string; sender?: string }>;
}

// ─── CRYPTO ─────────────────────────────────────────────────────────────

export const CRYPTO_SOURCES: CuratedSources = {
  niche: "crypto",
  igHandles: [
    { handle: "investidor4.20", label: "Lucas Amendola · Bitcoin BR", followers: "300k+" },
    { handle: "leobueno_", label: "Leo Bueno · cripto fundamento", followers: "100k+" },
    { handle: "anitarodrigues.crypto", label: "Anita Rodrigues · DeFi" },
    { handle: "mercadobitcoin", label: "Mercado Bitcoin (institucional)" },
    { handle: "binance", label: "Binance (global)" },
    { handle: "coinbase", label: "Coinbase" },
    { handle: "vitalik.eth", label: "Vitalik Buterin" },
    { handle: "documentingbtc", label: "Documenting Bitcoin" },
  ],
  youtubeChannels: [
    {
      handle: "@investidor4.20",
      channelId: "UC8oofAsuieQv3imZGvaUDOQ",
      label: "Investidor 4.20 (Lucas Amendola)",
    },
    { handle: "@criptocafé", label: "Crypto Café" },
    { handle: "@bankless", label: "Bankless" },
    { handle: "@cointelegraph", label: "Cointelegraph" },
    { handle: "@coinbureau", label: "Coin Bureau" },
  ],
  newsRss: [
    { name: "Cointelegraph BR", url: "https://br.cointelegraph.com/rss", lang: "pt" },
    { name: "Portal do Bitcoin", url: "https://portaldobitcoin.uol.com.br/feed/", lang: "pt" },
    { name: "Livecoins", url: "https://livecoins.com.br/feed/", lang: "pt" },
    { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", lang: "en" },
    { name: "The Block", url: "https://www.theblock.co/rss.xml", lang: "en" },
    { name: "Decrypt", url: "https://decrypt.co/feed", lang: "en" },
    { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/", lang: "en" },
  ],
  newsletterSubscribe: [
    {
      name: "Resumo Criptoverso (Defiverso · Lucas Amendola)",
      subscribeUrl: "https://defiverso.kaleidos.com.br/newsletter",
      sender: "lucas@defiverso.com.br",
    },
    { name: "Bankless", subscribeUrl: "https://www.bankless.com/", sender: "newsletter@bankless.com" },
    { name: "The Defiant", subscribeUrl: "https://thedefiant.io/", sender: "thedefiant@thedefiant.io" },
    { name: "Bitcoin Magazine", subscribeUrl: "https://bitcoinmagazine.com/newsletter", sender: "newsletter@bitcoinmagazine.com" },
    { name: "Blockworks Daily", subscribeUrl: "https://blockworks.co/newsletter/daily", sender: "daily@blockworks.co" },
    { name: "Milk Road", subscribeUrl: "https://milkroad.com/", sender: "kyle@milkroad.com" },
  ],
};

// ─── MARKETING ──────────────────────────────────────────────────────────

export const MARKETING_SOURCES: CuratedSources = {
  niche: "marketing",
  igHandles: [
    { handle: "leadgenman", label: "Marc Lousada · LinkedIn growth" },
    { handle: "tenfoldmarc", label: "Marc · ten-fold marketing" },
    { handle: "matheus.chibebe", label: "Matheus Chibebe · social BR" },
    { handle: "hormozi", label: "Alex Hormozi · business" },
    { handle: "garyvee", label: "Gary Vaynerchuk" },
    { handle: "blakeandersonw", label: "Blake Anderson · ads/founders" },
    { handle: "justinwelsh", label: "Justin Welsh · solopreneur" },
    { handle: "neilpatel", label: "Neil Patel · SEO" },
  ],
  youtubeChannels: [
    { handle: "@AlexHormozi", label: "Alex Hormozi" },
    { handle: "@GaryVee", label: "Gary Vaynerchuk" },
    { handle: "@AliAbdaal", label: "Ali Abdaal" },
    { handle: "@MarketingAgainsttheGrain", label: "Marketing Against the Grain" },
    { handle: "@Founder", label: "Founder Magazine" },
  ],
  newsRss: [
    { name: "Marketing Brew", url: "https://www.marketingbrew.com/feed", lang: "en" },
    { name: "Search Engine Land", url: "https://searchengineland.com/feed", lang: "en" },
    { name: "HubSpot Blog", url: "https://blog.hubspot.com/marketing/rss.xml", lang: "en" },
    { name: "MeioMensagem (BR)", url: "https://www.meioemensagem.com.br/feed/", lang: "pt" },
    { name: "B9 (BR)", url: "https://www.b9.com.br/feed/", lang: "pt" },
    { name: "Mercado e Consumo", url: "https://mercadoeconsumo.com.br/feed/", lang: "pt" },
  ],
  newsletterSubscribe: [
    { name: "Marketing Brew", subscribeUrl: "https://www.marketingbrew.com/subscribe", sender: "newsletter@morningbrew.com" },
    { name: "Demand Curve", subscribeUrl: "https://demandcurve.com/newsletter", sender: "founders@demandcurve.com" },
    { name: "Stacked Marketer", subscribeUrl: "https://stackedmarketer.com/", sender: "newsletter@stackedmarketer.com" },
    { name: "Why We Buy (Katelyn Bourgoin)", subscribeUrl: "https://whywebuy.beehiiv.com/", sender: "katelyn@whywebuy.co" },
    { name: "GrowthHackers", subscribeUrl: "https://growthhackers.com/newsletter", sender: "newsletter@growthhackers.com" },
  ],
};

// ─── IA ────────────────────────────────────────────────────────────────

export const AI_SOURCES: CuratedSources = {
  niche: "ai",
  igHandles: [
    { handle: "ogmadureira", label: "Gabriel Madureira · vibe coding/IA" },
    { handle: "hugodoria", label: "Hugo Doria · IA prática" },
    { handle: "openai", label: "OpenAI" },
    { handle: "anthropicai", label: "Anthropic" },
    { handle: "aitruth", label: "AI Truth · curadoria" },
    { handle: "filiperomero", label: "Filipe Romero · agentes IA" },
  ],
  youtubeChannels: [
    { handle: "@AndrejKarpathy", label: "Andrej Karpathy" },
    { handle: "@TwoMinutePapers", label: "Two Minute Papers" },
    { handle: "@matthewberman", label: "Matthew Berman · AI dev" },
    { handle: "@AIExplained-", label: "AI Explained" },
    { handle: "@DavidOndrej", label: "David Ondrej · vibe coding" },
  ],
  newsRss: [
    { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", lang: "en" },
    { name: "Anthropic News", url: "https://www.anthropic.com/news/rss", lang: "en" },
    { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", lang: "en" },
    { name: "DeepMind Blog", url: "https://deepmind.com/blog/feed/basic", lang: "en" },
    { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", lang: "en" },
    { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", lang: "en" },
  ],
  newsletterSubscribe: [
    { name: "The Rundown AI", subscribeUrl: "https://www.therundown.ai/", sender: "rundown@therundown.ai" },
    { name: "Ben's Bites", subscribeUrl: "https://bensbites.com/", sender: "ben@bensbites.com" },
    { name: "TLDR AI", subscribeUrl: "https://tldr.tech/ai", sender: "ai@tldr.tech" },
    { name: "Import AI (Jack Clark)", subscribeUrl: "https://importai.substack.com/", sender: "jack@importai.com" },
    { name: "AlphaSignal", subscribeUrl: "https://alphasignal.ai/", sender: "newsletter@alphasignal.ai" },
  ],
};

// ─── Lookup ────────────────────────────────────────────────────────────

export const ALL_CURATED_SOURCES: Record<string, CuratedSources> = {
  crypto: CRYPTO_SOURCES,
  marketing: MARKETING_SOURCES,
  ai: AI_SOURCES,
};

export function getCuratedSources(nicheId: string): CuratedSources | null {
  return ALL_CURATED_SOURCES[nicheId] ?? null;
}
