/**
 * GET /api/img?url=<encoded>
 *
 * Proxy de imagens IG/CDN. IG CDN retorna 403 sem Referer válido.
 * Fetch server-side com Referer instagram.com + cache 1h.
 *
 * Ported da v1.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "ytimg.com", // bonus: YouTube thumbs
];

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  // Match exato OU subdomínio com leading dot. `.endsWith(host)` puro deixa
  // passar `evilcdninstagram.com` quando host é `cdninstagram.com`.
  const hostname = parsed.hostname;
  const allowed = ALLOWED_HOSTS.some(
    (h) => hostname === h || hostname.endsWith("." + h),
  );
  if (!allowed) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  // Rate limit por IP — endpoint público, principal vetor de DoS/bandwidth.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = await rateLimit({
    key: `img:${ip}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        Referer: "https://www.instagram.com/",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      // 8s teto — atacante manda URL lenta = worker fica pendurado.
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: upstream.status },
      );
    }
    // Cap de tamanho (10MB) — fbcdn pode servir vídeo de minutos.
    const len = Number(upstream.headers.get("content-length") ?? 0);
    if (len > 10_000_000) {
      return NextResponse.json({ error: "too large" }, { status: 413 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, s-maxage=3600, max-age=600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "upstream timeout" },
        { status: 504 },
      );
    }
    console.error("[/api/img] failed:", err);
    return NextResponse.json({ error: "proxy failed" }, { status: 502 });
  }
}
