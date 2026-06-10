/**
 * GET /api/img?url=<encoded>
 *
 * Proxy de imagens IG/CDN. IG CDN retorna 403 sem Referer válido.
 * Fetch server-side com Referer instagram.com + cache 1h.
 *
 * Ported da v1.
 */

import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "ytimg.com", // YouTube thumbs
  "googleusercontent.com", // YouTube channel avatars (yt3.googleusercontent.com)
  "ggpht.com", // YouTube avatars (legado)
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "bytecdn.com",
  "twimg.com", // X avatars (best-effort)
];

/**
 * Defense-in-depth contra SSRF: mesmo com a allowlist de hosts acima, um
 * atacante poderia, via DNS rebinding, fazer um hostname allowlistado resolver
 * pra um IP interno (loopback/RFC1918/link-local/metadata cloud 169.254.169.254).
 * Aqui rejeitamos qualquer IP privado/reservado. NÃO altera a allowlist —
 * é uma checagem extra sobre o destino real do fetch.
 */
function isPrivateIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  if (kind === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
    if (lower.startsWith("fe80")) return true; // link-local
    // IPv4-mapped (::ffff:a.b.c.d) — extrai e revalida como v4
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  // net.isIP === 0 → não é IP literal; deixa o DNS resolver decidir.
  return false;
}

/**
 * Resolve o hostname e garante que NENHUM endereço resolvido seja privado.
 * Retorna true se o destino é seguro (todos os IPs públicos).
 */
async function isUpstreamHostSafe(hostname: string): Promise<boolean> {
  // Hostname já é IP literal? checa direto.
  if (net.isIP(hostname)) return !isPrivateIp(hostname);
  try {
    const addrs = await lookup(hostname, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    // Falha de DNS → bloqueia (fail-closed).
    return false;
  }
}

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

  // Defense-in-depth: bloqueia destino que resolve pra IP privado/loopback
  // (proteção contra SSRF via DNS rebinding). Não substitui a allowlist acima.
  if (!(await isUpstreamHostSafe(hostname))) {
    return NextResponse.json(
      { error: "host not allowed" },
      { status: 403 },
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
