import type { NextConfig } from "next";

/**
 * CSP laxa intencionalmente — permite Stripe.js, Vercel scripts, PostHog,
 * fontes Google. Refinar depois com nonces se entrar `dangerouslySetInnerHTML`
 * ou se quiser remover `unsafe-inline`/`unsafe-eval`. Hoje Next 16 + Tailwind
 * + shadcn não exigem inline scripts custom — `unsafe-inline` é só pra
 * Next runtime hydration.
 *
 * connect-src cobre Neon Auth (JWKS), Stripe API, Apify (cliente nunca chama,
 * mas deixar amplo evita dor de cabeça). Se for fechar, começar por aqui.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.vercel-scripts.com https://*.vercel.app https://js.stripe.com https://*.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.stripe.com https://api.stripe.com https://*.neon.tech https://*.kinde.com https://*.posthog.com https://*.vercel-insights.com https://vercel.live wss://*.vercel.live",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: csp },
];

const config: NextConfig = {
  // Permite que IG CDN sirva thumbs sem 403 quando referer é nosso domínio.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "scontent-*.cdninstagram.com" },
      { protocol: "https", hostname: "instagram.f*.fbcdn.net" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  // Preserva fetch errors verbose no dev pra debugar Apify/Gemini timeouts.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default config;
