/**
 * GET /api/data/newsletters?niche=&limit=
 *
 * Lê newsletter_articles populated pelo cron `/api/cron/newsletters` da v1
 * (Gmail API → Resend). Mostra subject + sender + snippet.
 */

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export interface NewsletterRow {
  id: number;
  gmail_message_id: string;
  thread_id: string | null;
  niche: string | null;
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  snippet: string | null;
  link_count: number | null;
  sent_at: string | null;
  fetched_at: string;
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DB ausente" }, { status: 503 });
  const auth = await requireUserId(req);
  if ("response" in auth) return auth.response;

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche") ?? "marketing";
  const limitRaw = Number(url.searchParams.get("limit") ?? 60);
  const limit = Math.min(120, Math.max(10, Number.isFinite(limitRaw) ? limitRaw : 60));

  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT id, gmail_message_id, thread_id, niche, sender_name, sender_email,
             subject, snippet, link_count, sent_at::text, fetched_at::text
        FROM newsletter_articles
       WHERE niche = ${niche}
       ORDER BY sent_at DESC NULLS LAST
       LIMIT ${limit}
    `) as unknown as NewsletterRow[];
    return NextResponse.json({ newsletters: rows });
  } catch (err) {
    console.error("[/api/data/newsletters] failed:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Falha" : String(err) },
      { status: 500 },
    );
  }
}
