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
  { id: "coin-bureau", name: "Coin Bureau", handle: "@CoinBureau", channelId: "UCqK_GSMbpiV8spgD3ZGloLA", niche: "crypto" },
  { id: "bankless", name: "Bankless", handle: "@Bankless", channelId: "UCAl-UjcFfl2z0YENET7v_ow", niche: "crypto" },
  { id: "into-the-cryptoverse", name: "Into The Cryptoverse", handle: "@intothecryptoverse", channelId: "UCRvqjQPSeaWn-uEx-w0XOIg", niche: "crypto" },
  { id: "altcoin-daily", name: "Altcoin Daily", handle: "@AltcoinDaily", channelId: "UCbLhGKVY-bJPcawebgtNfbw", niche: "crypto" },
  { id: "datadash", name: "DataDash", handle: "@datadash", channelId: "UCCatR7nWbYrkVXdxW1j4Gng", niche: "crypto" },
  { id: "whiteboard-crypto", name: "Whiteboard Crypto", handle: "@WhiteboardCrypto", channelId: "UCsYYksPHiGqXHPoHI-fm5sg", niche: "crypto" },
  { id: "99bitcoins", name: "99Bitcoins", handle: "@99Bitcoins", channelId: "UCBP_ZnkHHJMb9n9qSLIMEL0", niche: "crypto" },
  { id: "the-crypto-lark", name: "The Crypto Lark", handle: "@TheCryptoLark", channelId: "UCl2oCaw8hdR_kbqyqd2klIA", niche: "crypto" },
  { id: "wolf-of-all-streets", name: "Wolf of All Streets", handle: "@scottmelker", channelId: "UCT3XltZSNHPHdPpGxGIoMDA", niche: "crypto" },
  { id: "real-vision-crypto", name: "Real Vision Crypto", handle: "@realvisioncrypto", channelId: "UCXmhDAS7g6kWe7Sgnl-7O4A", niche: "crypto" },
  { id: "crypto-banter", name: "Crypto Banter", handle: "@CryptoBanter", channelId: "UCN9Nj4tjXbVTLYWN0EKly_Q", niche: "crypto" },
  { id: "invest-answers", name: "InvestAnswers", handle: "@InvestAnswers", channelId: "UCqmn6C72BbLMfqADSFBMBFw", niche: "crypto" },
  { id: "paul-barron-network", name: "Paul Barron Network", handle: "@PaulBarronNetwork", channelId: "UCIFaFKU3VZuNRaQwQ_BGTEg", niche: "crypto" },
  { id: "digital-asset-news", name: "Digital Asset News", handle: "@DigitalAssetNews", channelId: "UCJgHxpqfhWEEjYH9cLXqhIQ", niche: "crypto" },
  { id: "crypto-casey", name: "Crypto Casey", handle: "@CryptoCasey", channelId: "UCl-PbXZe9wCgmQlBWhQZ2Fg", niche: "crypto" },
  { id: "andrei-jikh", name: "Andrei Jikh", handle: "@AndreiJikh", channelId: "UCGy7SkBjcIAgTiwkXEtPnYg", niche: "crypto" },
  { id: "graham-stephan", name: "Graham Stephan", handle: "@GrahamStephan", channelId: "UCV6KDgJskWaEckne5aPA0aQ", niche: "crypto" },
  { id: "pompliano", name: "Anthony Pompliano", handle: "@AnthonyPompliano", channelId: "UCeqSMkY_-JkWEtdp4PXldSw", niche: "crypto" },
  { id: "unchained-crypto", name: "Unchained (Laura Shin)", handle: "@UnchainedCrypto", channelId: "UCQE7y_9LoWFjbniYNLGF67w", niche: "crypto" },
  { id: "the-modern-investor", name: "The Modern Investor", handle: "@TheModernInvestor", channelId: "UCaVa-VoEBNNkD0oL4YzFXJA", niche: "crypto" },
  { id: "crypto-zombie", name: "Crypto Zombie", handle: "@cryptozombie", channelId: "UCiUnrCUGCJTCC7KjuW493Ww", niche: "crypto" },
  { id: "bitboy-crypto", name: "BitBoy Crypto", handle: "@BitBoyCrypto", channelId: "UCjemQfjaXAzA-95RKoy9n_g", niche: "crypto" },
  { id: "crypto-tips", name: "Crypto Tips", handle: "@CryptoTips", channelId: "UCZeTLBfbJANxFxd1BXFB9UA", niche: "crypto" },
  { id: "decrypt-media", name: "Decrypt", handle: "@DecryptMedia", channelId: "UCuSaQHBSXT1lIEK0UGMF3tA", niche: "crypto" },
  { id: "ivan-on-tech", name: "Ivan on Tech", handle: "@IvanOnTech", channelId: "UCrM7B7SL_g1edFOnmj-SDKg", niche: "crypto" },
  { id: "augusto-backes", name: "Augusto Backes", handle: "@augustobackes", channelId: "UCrBBvLMzWJxMlGIFKzjFHwQ", niche: "crypto" },
  { id: "bitcoin-banco", name: "Bitcoin Banco", handle: "@grupoBitcoinBanco", channelId: "UCBW-K4pxnRvuSBuMCXDFuoA", niche: "crypto" },
  { id: "canal-do-holder", name: "Canal do Holder", handle: "@canaldoholder", channelId: "UC-j4QNBME1_grSYh17kSMlw", niche: "crypto" },
  { id: "cripto-reto", name: "Cripto Reto", handle: "@criptoreto", channelId: "UC9b1WKCzPXJbAoKXLJb8J1A", niche: "crypto" },
  { id: "universo-cripto", name: "Universo Cripto", handle: "@universocripto", channelId: "UCmXp3bMSIJNF7i5o5B9zs6g", niche: "crypto" },
  { id: "investidor-420", name: "Investidor 4.20", handle: "@Investidor4.20", channelId: "UC8oofAsuieQv3imZGvaUDOQ", niche: "crypto" },
  { id: "alex-hormozi", name: "Alex Hormozi", handle: "@AlexHormozi", channelId: "UCUyDOdBWhC1MCxEjC46d-zw", niche: "marketing" },
  { id: "gary-vee", name: "GaryVee", handle: "@garyvee", channelId: "UCctXZhXmG-kf3tlIXgVZUlw", niche: "marketing" },
  { id: "neil-patel", name: "Neil Patel", handle: "@neilpatel", channelId: "UCl-Zrl0QhF66lu1aGXaTbfw", niche: "marketing" },
  { id: "ahrefs", name: "Ahrefs", handle: "@AhrefsCom", channelId: "UCWquNQV8Y0_defMKnGKrFOQ", niche: "marketing" },
  { id: "matt-diggity", name: "Matt Diggity", handle: "@mattdiggityseo", channelId: "UCt9KrigL_ZbCFpCB66j6mLQ", niche: "marketing" },
  { id: "matt-gray", name: "Matt Gray", handle: "@mattgrayyy", channelId: "UCdJ0pPFPPF3y6PaTBgjBLQg", niche: "marketing" },
  { id: "justin-welsh", name: "Justin Welsh", handle: "@JustinWelshOfficial", channelId: "UCAqLQ_5jPoZepEsk09Gj5Lw", niche: "marketing" },
  { id: "income-school", name: "Income School", handle: "@IncomeSchool", channelId: "UCO5l5J5j5K7Cm5T8A4FJoVA", niche: "marketing" },
  { id: "fellipe-toledo", name: "Fellipe Toledo", handle: "@fellipetoledo", channelId: "UCV9rW2yFcZ6_oKjvRwK3vNw", niche: "marketing" },
  { id: "colin-bryar", name: "Colin and Samir", handle: "@ColinandSamir", channelId: "UCamLstJyCa-t5gfZegxsFMw", niche: "marketing" },
  { id: "matt-wolfe", name: "Matt Wolfe", handle: "@mreflow", channelId: "UChpleBmo18P08aKCIgti38g", niche: "ai" },
  { id: "aiexplained", name: "AI Explained", handle: "@aiexplained-official", channelId: "UCNJ1Ymd5yFuUPtn21xtRbbw", niche: "ai" },
  { id: "fireship", name: "Fireship", handle: "@Fireship", channelId: "UCsBjURrPoezykLs9EqgamOA", niche: "ai" },
  { id: "matthew-berman", name: "Matthew Berman", handle: "@matthew_berman", channelId: "UCawZsQWqfGSbCI5yjkdVkTA", niche: "ai" },
  { id: "wes-roth", name: "Wes Roth", handle: "@WesRoth", channelId: "UCqcbQf6yw5KzRoDDcZ_wBSw", niche: "ai" },
  { id: "all-about-ai", name: "All About AI", handle: "@AllAboutAI", channelId: "UCR-DXc1voovS8nhAvccRZhg", niche: "ai" },
  { id: "sam-witteveen", name: "Sam Witteveen", handle: "@samwitteveenai", channelId: "UC55ODhRtAEdSKfTo9LzXFog", niche: "ai" },
  { id: "ai-jason", name: "AI Jason", handle: "@AIJasonZ", channelId: "UCC1l5O-vrePfV-bPOV7zsGA", niche: "ai" },
  { id: "lex-fridman", name: "Lex Fridman", handle: "@lexfridman", channelId: "UCSHZKyawb77ixDdsGog4iWA", niche: "ai" },
  { id: "dwarkesh", name: "Dwarkesh Patel", handle: "@DwarkeshPatel", channelId: "UCVpD7DlwQoWZsWEBvbiB-uQ", niche: "ai" },
];

export function getChannelsByNiche(niche: string): YoutubeChannel[] {
  return YOUTUBE_CHANNELS.filter((c) => c.niche === niche);
}
