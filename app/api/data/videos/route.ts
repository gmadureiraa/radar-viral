/**
 * GET /api/data/videos?niche=marketing&days=7&limit=60
 *
 * Lista vídeos recentes do feed YouTube. Filtro por nicho usa o catálogo
 * curado (`lib/sources-curated.ts`) — converte o slug em lista de handles
 * e usa WHERE channel_handle IN (...). Sem nicho retorna tudo (admin only).
 *
 * v1 popula `videos` via cron RSS. Schema da tabela: video_id PK,
 * channel_handle, published_at, etc — sem coluna niche.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";
import { getCuratedSources } from "@/lib/sources-curated";

export const runtime = "nodejs";

export interface VideoRow {
  video_id: string;
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  country: string | null;
  category: string | null;
  title: string;
  thumbnail_url: string;
  published_at: string;
  link: string;
  first_seen_at: string;
  last_seen_at: string;
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche");
  const daysRaw = Number(url.searchParams.get("days") ?? 7);
  const hoursParam = url.searchParams.get("hours");
  const hours = hoursParam ? Math.min(720, Math.max(1, Number(hoursParam) || 0)) : null;
  const limitRaw = Number(url.searchParams.get("limit") ?? 60);
  const days = Math.min(60, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
  const limit = Math.min(120, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  // hours, se informado, sobrescreve days (transforma em window curtinha tipo 24h/48h).
  const intervalUnit = hours ? "hours" : "days";
  const intervalQty = hours ?? days;

  // Resolve handles do nicho via catálogo curado.
  let handleFilter: string[] | null = null;
  if (niche) {
    const curated = getCuratedSources(niche);
    if (curated) {
      handleFilter = curated.youtubeChannels.map((c) =>
        c.handle.startsWith("@") ? c.handle : `@${c.handle}`,
      );
    }
  }

  const sql = getSql();
  try {
    const rows = handleFilter
      ? ((await sql`
          SELECT video_id, channel_id, channel_name, channel_handle, country,
                 category, title, thumbnail_url, published_at::text, link,
                 first_seen_at::text, last_seen_at::text
            FROM videos
           WHERE published_at >= NOW() - (${intervalQty} || ' ' || ${intervalUnit})::interval
             AND channel_handle = ANY(${handleFilter})
           ORDER BY published_at DESC NULLS LAST
           LIMIT ${limit}
        `) as unknown as VideoRow[])
      : ((await sql`
          SELECT video_id, channel_id, channel_name, channel_handle, country,
                 category, title, thumbnail_url, published_at::text, link,
                 first_seen_at::text, last_seen_at::text
            FROM videos
           WHERE published_at >= NOW() - (${intervalQty} || ' ' || ${intervalUnit})::interval
           ORDER BY published_at DESC NULLS LAST
           LIMIT ${limit}
        `) as unknown as VideoRow[]);
    return NextResponse.json({ videos: rows });
  } catch (err) {
    console.error("[/api/data/videos] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
