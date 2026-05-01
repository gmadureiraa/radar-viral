/**
 * Helper pra construir URL do /api/img proxy.
 *
 * IG CDN retorna 403 quando hot-linkado. YT thumbs retornam OK direto mas
 * passar pelo proxy padroniza cache.
 */

const PROXY_HOSTS = ["cdninstagram.com", "fbcdn.net", "instagram.com"];

export function imgProxy(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    // Só passa pelo proxy se for host que precisa (IG/FBcdn). YT pode direto.
    if (PROXY_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
      return `/api/img?url=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
}
