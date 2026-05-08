/**
 * Catálogo curado de canais YouTube por nicho.
 * Importado do v1 (channels.ts) — 51 canais com channelId resolvido.
 * Usado por cron/refresh pra montar feed RSS de cada canal.
 */

export interface YoutubeChannel {
  id: string;
  name: string;
  handle: string;
  channelId: string;
  niche: "crypto" | "marketing" | "ai";
}

export const YOUTUBE_CHANNELS: YoutubeChannel[] = [
  { id: "coin-bureau", name: "Coin Bureau", handle: "@CoinBureau", channelId: "UCqK_GSMbpiV8spgD3ZGloSw", niche: "crypto" },
  { id: "bankless", name: "Bankless", handle: "@Bankless", channelId: "UCAl9Ld79qaZxp9JzEOwd3aA", niche: "crypto" },
  { id: "into-the-cryptoverse", name: "Into The Cryptoverse", handle: "@intothecryptoverse", channelId: "UCRvqjQPSeaWn-uEx-w0XOIg", niche: "crypto" },
  { id: "altcoin-daily", name: "Altcoin Daily", handle: "@AltcoinDaily", channelId: "UCbLhGKVY-bJPcawebgtNfbw", niche: "crypto" },
  { id: "datadash", name: "DataDash", handle: "@datadash", channelId: "UCCatR7nWbYrkVXdxXb4cGXw", niche: "crypto" },
  { id: "whiteboard-crypto", name: "Whiteboard Crypto", handle: "@WhiteboardCrypto", channelId: "UCsYYksPHiGqXHPoHI-fm5sg", niche: "crypto" },
  { id: "99bitcoins", name: "99Bitcoins", handle: "@99Bitcoins", channelId: "UCQQ_fGcMDxlKre3SEqEWrLA", niche: "crypto" },
  { id: "the-crypto-lark", name: "The Crypto Lark", handle: "@TheCryptoLark", channelId: "UCl2oCaw8hdR_kbqyqd2klIA", niche: "crypto" },
  { id: "wolf-of-all-streets", name: "Wolf of All Streets", handle: "@scottmelker", channelId: "UCxIU1RFIdDpvA8VOITswQ1A", niche: "crypto" },
  { id: "crypto-banter", name: "Crypto Banter", handle: "@CryptoBanter", channelId: "UCN9Nj4tjXbVTLYWN0EKly_Q", niche: "crypto" },
  { id: "invest-answers", name: "InvestAnswers", handle: "@InvestAnswers", channelId: "UClgJyzwGs-GyaNxUHcLZrkg", niche: "crypto" },
  { id: "paul-barron-network", name: "Paul Barron Network", handle: "@PaulBarronNetwork", channelId: "UC4VPa7EOvObpyCRI4YKRQRw", niche: "crypto" },
  { id: "digital-asset-news", name: "Digital Asset News", handle: "@DigitalAssetNews", channelId: "UCJgHxpqfhWEEjYH9cLXqhIQ", niche: "crypto" },
  { id: "crypto-casey", name: "Crypto Casey", handle: "@CryptoCasey", channelId: "UCi7RBPfTtRkVchV6qO8PUzg", niche: "crypto" },
  { id: "andrei-jikh", name: "Andrei Jikh", handle: "@AndreiJikh", channelId: "UCGy7SkBjcIAgTiwkXEtPnYg", niche: "crypto" },
  { id: "graham-stephan", name: "Graham Stephan", handle: "@GrahamStephan", channelId: "UCV6KDgJskWaEckne5aPA0aQ", niche: "crypto" },
  { id: "pompliano", name: "Anthony Pompliano", handle: "@AnthonyPompliano", channelId: "UCevXpeL8cNyAnww-NqJ4m2w", niche: "crypto" },
  { id: "unchained-crypto", name: "Unchained (Laura Shin)", handle: "@UnchainedCrypto", channelId: "UCWiiMnsnw5Isc2PP1to9nNw", niche: "crypto" },
  { id: "the-modern-investor", name: "The Modern Investor", handle: "@TheModernInvestor", channelId: "UC-5HLi3buMzdxjdTdic3Aig", niche: "crypto" },
  { id: "crypto-zombie", name: "Crypto Zombie", handle: "@cryptozombie", channelId: "UCiUnrCUGCJTCC7KjuW493Ww", niche: "crypto" },
  { id: "bitboy-crypto", name: "BitBoy Crypto", handle: "@BitBoyCrypto", channelId: "UCjemQfjaXAzA-95RKoy9n_g", niche: "crypto" },
  { id: "crypto-tips", name: "Crypto Tips", handle: "@CryptoTips", channelId: "UCavTvSwEoRABvnPtLg0e6LQ", niche: "crypto" },
  { id: "decrypt-media", name: "Decrypt", handle: "@DecryptMedia", channelId: "UC-dmTM1R31S8uFgPmexxkNg", niche: "crypto" },
  { id: "ivan-on-tech", name: "Ivan on Tech", handle: "@IvanOnTech", channelId: "UCrM7B7SL_g1edFOnmj-SDKg", niche: "crypto" },
  { id: "augusto-backes", name: "Augusto Backes", handle: "@augustobackes", channelId: "UCNGqYuEd86K7dY70jE6dhKg", niche: "crypto" },
  { id: "canal-do-holder", name: "Canal do Holder", handle: "@canaldoholder", channelId: "UCJIcpGAVfGIVgHSQ6oCcrXg", niche: "crypto" },
  { id: "investidor-420", name: "Investidor 4.20", handle: "@Investidor4.20", channelId: "UC8oofAsuieQv3imZGvaUDOQ", niche: "crypto" },
  { id: "alex-hormozi", name: "Alex Hormozi", handle: "@AlexHormozi", channelId: "UCUyDOdBWhC1MCxEjC46d-zw", niche: "marketing" },
  { id: "gary-vee", name: "GaryVee", handle: "@garyvee", channelId: "UCctXZhXmG-kf3tlIXgVZUlw", niche: "marketing" },
  { id: "neil-patel", name: "Neil Patel", handle: "@neilpatel", channelId: "UCl-Zrl0QhF66lu1aGXaTbfw", niche: "marketing" },
  { id: "ahrefs", name: "Ahrefs", handle: "@AhrefsCom", channelId: "UCWquNQV8Y0_defMKnGKrFOQ", niche: "marketing" },
  { id: "income-school", name: "Income School", handle: "@IncomeSchool", channelId: "UCytOqtKYpACcWMD14UjhSeQ", niche: "marketing" },
  { id: "fellipe-toledo", name: "Fellipe Toledo", handle: "@fellipetoledo", channelId: "UCGVQSuNSc4aTqwgEX6bGbjw", niche: "marketing" },
  { id: "colin-bryar", name: "Colin and Samir", handle: "@ColinandSamir", channelId: "UCamLstJyCa-t5gfZegxsFMw", niche: "marketing" },
  { id: "matt-wolfe", name: "Matt Wolfe", handle: "@mreflow", channelId: "UChpleBmo18P08aKCIgti38g", niche: "ai" },
  { id: "aiexplained", name: "AI Explained", handle: "@aiexplained-official", channelId: "UCNJ1Ymd5yFuUPtn21xtRbbw", niche: "ai" },
  { id: "fireship", name: "Fireship", handle: "@Fireship", channelId: "UCsBjURrPoezykLs9EqgamOA", niche: "ai" },
  { id: "matthew-berman", name: "Matthew Berman", handle: "@matthew_berman", channelId: "UCawZsQWqfGSbCI5yjkdVkTA", niche: "ai" },
  { id: "wes-roth", name: "Wes Roth", handle: "@WesRoth", channelId: "UCqcbQf6yw5KzRoDDcZ_wBSw", niche: "ai" },
  { id: "all-about-ai", name: "All About AI", handle: "@AllAboutAI", channelId: "UCR-DXc1voovS8nhAvccRZhg", niche: "ai" },
  { id: "sam-witteveen", name: "Sam Witteveen", handle: "@samwitteveenai", channelId: "UC55ODQSvARtgSyc8ThfiepQ", niche: "ai" },
  { id: "ai-jason", name: "AI Jason", handle: "@AIJasonZ", channelId: "UCrXSVX9a1mj8l0CMLwKgMVw", niche: "ai" },
  { id: "lex-fridman", name: "Lex Fridman", handle: "@lexfridman", channelId: "UCSHZKyawb77ixDdsGog4iWA", niche: "ai" },
  { id: "dwarkesh", name: "Dwarkesh Patel", handle: "@DwarkeshPatel", channelId: "UCXl4i9dYBrFOabk0xGmbkRA", niche: "ai" },
];

export function getChannelsByNiche(niche: string): YoutubeChannel[] {
  return YOUTUBE_CHANNELS.filter((c) => c.niche === niche);
}

/**
 * Resolve um handle YouTube (`@daniel`, `daniel`, `UC...`) pra channelId
 * canônico (`UC...` 24 chars). Necessário pro cron individual: feeds RSS
 * exigem channelId, e users normalmente colam só o @handle.
 *
 * Estratégia: scrape leve do `https://www.youtube.com/@${handle}` e parse
 * do `"channelId":"UC..."` que aparece no bundle JS embedded. Sem dep de
 * YouTube Data API (gratuito até 10k req/day mas exige API key).
 *
 * Retorna `null` se handle inválido ou page não carrega.
 */
export async function resolveYouTubeChannelId(
  rawHandle: string,
): Promise<{ channelId: string; channelName?: string } | null> {
  const cleaned = rawHandle.replace(/^@/, "").trim();
  if (!cleaned) return null;

  // Já é channelId UC... 24 chars — só ratifica
  if (/^UC[A-Za-z0-9_-]{22}$/.test(cleaned)) {
    return { channelId: cleaned };
  }

  const url = `https://www.youtube.com/@${encodeURIComponent(cleaned)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RadarViral/1.0; +https://radar.kaleidos.com.br)",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Padrões de channelId no HTML do YouTube (em ordem de confiabilidade)
    const m =
      /"channelId":"(UC[A-Za-z0-9_-]{22})"/.exec(html) ??
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(
        html,
      ) ??
      /<meta itemprop="(?:channelId|identifier)" content="(UC[A-Za-z0-9_-]{22})"/.exec(
        html,
      );
    if (!m) return null;

    const nameMatch =
      /<meta property="og:title" content="([^"]+)"/.exec(html) ??
      /"title":"([^"]+)"/.exec(html);
    const channelName = nameMatch?.[1]
      ?.replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    return { channelId: m[1], channelName };
  } catch {
    return null;
  }
}
