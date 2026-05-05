/**
 * Email dispatch — Radar Viral.
 *
 * Sem `resend` SDK e sem `@react-email/components` (mantém deps mínimas
 * — radar-viral hoje só usa `@react-email` em zero lugar). HTML é gerado
 * inline aqui mesmo com a brand do Radar (paper + REC coral).
 *
 * Uso atual: `sendReferralConverted(...)` no fluxo de webhook Stripe quando
 * um indicado paga e o referrer ganha R$ 25 de crédito.
 *
 * From canônico: `Radar Viral <radar@news.kaleidos.com.br>`
 * Reply-to:      `madureira@kaleidosdigital.com`
 *
 * Falha silenciosa: se RESEND_API_KEY estiver ausente, log warn e segue —
 * webhook do Stripe nunca pode falhar por causa de email transacional.
 */

const RESEND_API = "https://api.resend.com";

const FROM = "Radar Viral <radar@news.kaleidos.com.br>";
const REPLY_TO = "madureira@kaleidosdigital.com";

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://radar.kaleidos.com.br";

const PROJECT_TAG = { name: "project", value: "radar-viral" };
const ENV_TAG = {
  name: "env",
  value: process.env.NODE_ENV === "production" ? "prod" : "dev",
};

interface ResendErrorBody {
  name?: string;
  message?: string;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /** Alias do template — útil pra agrupar métricas no painel Resend. */
  templateAlias?: string;
  /** Plain text fallback. Default: stripe HTML básico. */
  text?: string;
}

async function send({
  to,
  subject,
  html,
  templateAlias,
  text,
}: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY ausente — skip send");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  const tags = [
    PROJECT_TAG,
    ENV_TAG,
    ...(templateAlias
      ? [{ name: "template", value: templateAlias }]
      : []),
  ];

  try {
    const res = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: FROM,
        to,
        reply_to: REPLY_TO,
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, "").trim(),
        tags,
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as ResendErrorBody;
        if (body?.message) msg = body.message;
      } catch {
        /* ignore */
      }
      console.warn(`[email] send falhou (${subject}):`, msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[email] send threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ────────────────────────────────────────────────────────────────────
// Template: referral converted
// ────────────────────────────────────────────────────────────────────

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatBrl(cents: number): string {
  const v = cents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

/**
 * HTML do email de conversão de indicação. Brand Radar:
 *   - paper #F5F1E8 background
 *   - ink #0A0908 texto
 *   - REC #FF3D2E accent
 *   - Brutalist border (1.5px ink) + shadow (4px 4px 0 ink)
 */
function renderReferralConvertedHTML(args: {
  firstName: string;
  rewardCents: number;
  totalCreditCents: number;
}): string {
  const reward = formatBrl(args.rewardCents);
  const total = formatBrl(args.totalCreditCents);
  const name = escape(args.firstName);
  const ctaUrl = `${APP_URL}/app/settings/referrals`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>+ ${reward} no seu saldo Radar Viral</title>
</head>
<body style="margin:0;padding:32px 0;background:#F5F1E8;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif;color:#0A0908;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1E8;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FBF7EE;border:1.5px solid #0A0908;box-shadow:6px 6px 0 0 #0A0908;">
        <tr><td style="padding:36px 36px 28px;">
          <div style="font-family:'Geist Mono','SF Mono',ui-monospace,monospace;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#FF3D2E;margin:0 0 14px;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#FF3D2E;vertical-align:middle;margin-right:8px;"></span>
            INDIQUE E GANHE
          </div>
          <h1 style="font-family:'Instrument Serif','Playfair Display',Georgia,serif;font-size:34px;line-height:1.05;letter-spacing:-0.02em;margin:0 0 16px;color:#0A0908;font-weight:400;">
            ${name}, você acabou de ganhar <em style="font-style:italic;color:#FF3D2E;">${reward}</em>.
          </h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 14px;color:#0A0908;">
            Um amigo seu acabou de assinar o <strong>Radar Viral</strong> usando seu link de indicação. Como combinado, <strong>${reward}</strong> entraram no seu saldo agora.
          </p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#0A0908;">
            Crédito total acumulado: <strong>${total}</strong>. Vai abater automaticamente na sua próxima fatura, sem precisar fazer nada.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
            <tr><td>
              <a href="${ctaUrl}" style="display:inline-block;background:#FF3D2E;color:#FBF7EE;padding:12px 22px;border:1.5px solid #0A0908;font-family:'Geist Mono','SF Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;text-decoration:none;box-shadow:4px 4px 0 0 #0A0908;">
                Ver minhas indicações →
              </a>
            </td></tr>
          </table>
          <p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#0A0908;">
            Continua valendo: cada amigo novo que assinar com seu link te dá <strong>${reward}</strong> de crédito. Sem limite de indicações, e os créditos acumulam.
          </p>
          <hr style="border:none;border-top:1px solid #DDD7CA;margin:24px 0 14px;" />
          <p style="font-size:11px;line-height:1.6;margin:0;color:#6B6660;">
            Você recebeu este email porque tem conta no Radar Viral. Pra cancelar comunicações, responda este email com "cancelar".
          </p>
          <p style="font-size:11px;line-height:1.6;margin:8px 0 0;color:#6B6660;">
            Feito no Brasil por <a href="https://kaleidos.ag" style="color:#6B6660;">Kaleidos</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendReferralConverted(
  user: { email: string; name?: string | null },
  args: { rewardCents: number; totalCreditCents: number },
): Promise<{ ok: boolean; error?: string }> {
  const firstName = (user.name || "").trim().split(" ")[0] || "você";
  const reward = formatBrl(args.rewardCents);

  return send({
    to: user.email,
    subject: `+ ${reward} no seu saldo Radar Viral`,
    html: renderReferralConvertedHTML({
      firstName,
      rewardCents: args.rewardCents,
      totalCreditCents: args.totalCreditCents,
    }),
    templateAlias: "radar-referral-converted-v1",
  });
}
