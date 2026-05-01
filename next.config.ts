import type { NextConfig } from "next";

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
};

export default config;
