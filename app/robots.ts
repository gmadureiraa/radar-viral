import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://radar.kaleidos.com.br";

/**
 * robots.txt. Bloqueia a área logada (/app/*) e a API do índice de busca —
 * são páginas client-only atrás de auth, sem valor pra crawler. Landing,
 * privacy e terms ficam liberadas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
