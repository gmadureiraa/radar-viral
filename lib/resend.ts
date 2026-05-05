/**
 * Resend integration — contacts/audience + events pra automação de leads.
 *
 * Uso: depois do signup (email + Google OAuth) sincroniza no Resend audience
 * "Radar Viral" e dispara um event semântico (`radar.signup`). Webhook do
 * Stripe também dispara events (`radar.upgraded`, `radar.canceled`,
 * `radar.payment.failed`) pra alimentar automação no painel Resend
 * (welcome → onboarding → upgrade nudges → win-back).
 *
 * Env vars:
 *   - RESEND_API_KEY: re_xxxxx (server-side only, sem NEXT_PUBLIC_)
 *   - RESEND_RADAR_AUDIENCE_ID: id da audience "Radar Viral" (criar no
 *     painel Resend → audiences → "Radar Viral" → copy id)
 *
 * Falha silenciosa: se Resend cair ou key faltar, signup/webhook seguem
 * normais — não bloqueia conversão. Erros vão pro console pra debug.
 *
 * Por que fetch direto e não SDK? evita +1 dependência (e build heavier),
 * já que só chamamos 2 endpoints REST simples. Mesmo padrão do app brother
 * Reels Viral, exceto que aqui rodamos sem o pacote `resend`.
 */

const RESEND_API = "https://api.resend.com";

interface ResendErrorBody {
  name?: string;
  message?: string;
}

interface ResendContact {
  id?: string;
  email?: string;
}

function getKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

function getAudienceId(): string | null {
  return process.env.RESEND_RADAR_AUDIENCE_ID ?? null;
}

async function resendFetch<T>(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const key = getKey();
  if (!key) return { ok: false, error: "RESEND_API_KEY missing", status: 0 };

  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
  });

  // 204 No Content (DELETE etc) — sem body
  if (res.status === 204) {
    return { ok: true, data: undefined as unknown as T };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* sem body — segue */
  }

  if (!res.ok) {
    const err = body as ResendErrorBody | null;
    return {
      ok: false,
      error: err?.message ?? `HTTP ${res.status}`,
      status: res.status,
    };
  }

  return { ok: true, data: body as T };
}

export interface UpsertLeadInput {
  email: string;
  /** Nome (opcional) — default: parte antes do @ do email. */
  firstName?: string | null;
  /** Tags pra segmentação (registradas como metadata via event, não no contact). */
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Cria ou atualiza um contact na audience "Radar Viral".
 *
 * Resend não tem `upsert` nativo — tenta create primeiro; se já existe,
 * faz GET pra retornar id consistente. Falha silenciosa: erros logados
 * mas não propagam (nunca bloqueia signup do user).
 *
 * Tags ficam no event (POST /events) porque a API REST de contacts não
 * persiste arrays arbitrários. A automação no painel Resend filtra por
 * propriedades do event, não por atributos do contact.
 */
export async function upsertLeadInAudience(input: UpsertLeadInput): Promise<void> {
  const audienceId = getAudienceId();
  if (!audienceId) {
    if (getKey()) {
      console.warn("[resend] RESEND_RADAR_AUDIENCE_ID missing — skip upsert");
    }
    return;
  }

  const email = input.email.toLowerCase().trim();
  const firstName =
    input.firstName?.trim() || email.split("@")[0] || "Radar Viral User";

  const created = await resendFetch<ResendContact>(
    `/audiences/${audienceId}/contacts`,
    {
      method: "POST",
      body: JSON.stringify({
        email,
        first_name: firstName,
        unsubscribed: false,
      }),
    },
  );

  if (created.ok) return;

  const msg = created.error.toLowerCase();
  const alreadyExists =
    msg.includes("already exists") ||
    msg.includes("contact already") ||
    created.status === 409 ||
    created.status === 422;

  if (alreadyExists) {
    // Já cadastrado — confirmamos via GET (sem-op se já está OK).
    const got = await resendFetch<ResendContact>(
      `/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`,
      { method: "GET" },
    );
    if (!got.ok) {
      console.warn(
        `[resend] upsert: contact existente mas GET falhou: ${got.error}`,
      );
    }
    return;
  }

  console.warn(`[resend] upsertLeadInAudience falhou: ${created.error}`);
}

/**
 * Dispara um event customizado pra Resend (consumido por automações).
 *
 * Endpoint: POST /events. Payload:
 *   { name: "radar.signup", data: { email, plan, ... } }
 *
 * Resend usa `name` como trigger de automação e `data` como variáveis pro
 * template do email. Falha silenciosa.
 */
export async function fireResendEvent(
  name: string,
  data: Record<string, unknown>,
): Promise<void> {
  const key = getKey();
  if (!key) return;

  const res = await resendFetch<unknown>("/events", {
    method: "POST",
    body: JSON.stringify({ name, data }),
  });

  if (!res.ok) {
    console.warn(`[resend] fireResendEvent(${name}) falhou: ${res.error}`);
  }
}
