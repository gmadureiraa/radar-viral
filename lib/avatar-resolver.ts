/**
 * Resolve avatar URL de uma fonte (IG, YT, TikTok, Threads) via scrape leve
 * do meta `og:image` da página pública de perfil. Sem dep de APIs pagas.
 *
 * Fallback: retorna `null` se a página não carrega ou não tem og:image.
 *
 * Usado por:
 *  - /api/sources POST: ao adicionar fonte, popula avatar_url
 *  - /api/sources/refresh-avatar: recoleta sob demanda quando user clica
 *
 * NOTA: og:image expira (esp. IG/Threads CDN). Pode ser revalidado
 * periodicamente em background, ou via re-scrape on-demand.
 */

const FETCH_TIMEOUT_MS = 8_000;

const UA =
  "Mozilla/5.0 (compatible; RadarViral/1.0; +https://radar.kaleidos.com.br)";

interface ResolveResult {
  avatarUrl: string | null;
  displayName: string | null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractOgImage(html: string): string | null {
  // Match flexível pra ordens diferentes de atributos (og:image vs property)
  const patterns = [
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+property="og:image"/i,
    /<meta\s+name="og:image"\s+content="([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function extractOgTitle(html: string): string | null {
  const m =
    /<meta\s+property="og:title"\s+content="([^"]+)"/i.exec(html) ??
    /<meta\s+name="og:title"\s+content="([^"]+)"/i.exec(html);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");
}

export async function resolveSourceAvatar(
  platform: string,
  rawHandle: string,
): Promise<ResolveResult> {
  const handle = rawHandle.replace(/^@/, "").trim();
  if (!handle) return { avatarUrl: null, displayName: null };

  let url: string | null = null;
  switch (platform) {
    case "instagram":
      url = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
      break;
    case "youtube":
      // Aceita @handle, channel name, ou UC...
      if (/^UC[A-Za-z0-9_-]{22}$/.test(handle)) {
        url = `https://www.youtube.com/channel/${handle}`;
      } else {
        url = `https://www.youtube.com/@${encodeURIComponent(handle)}`;
      }
      break;
    case "tiktok":
      url = `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
      break;
    case "threads":
      url = `https://www.threads.net/@${encodeURIComponent(handle)}`;
      break;
    default:
      return { avatarUrl: null, displayName: null };
  }

  const html = await fetchHtml(url);
  if (!html) return { avatarUrl: null, displayName: null };

  return {
    avatarUrl: extractOgImage(html),
    displayName: extractOgTitle(html),
  };
}
