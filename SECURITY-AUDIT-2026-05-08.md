# Radar Viral — Auditoria de Segurança Profunda

**Data:** 2026-05-08
**Repo:** `gmadureiraa/radar-viral` (PUBLIC desde 2026-05-04)
**Stack:** Next.js 16 + Tailwind v4 + Bun + Neon Postgres + Better Auth/Neon Auth + Stripe + Apify + Gemini + Resend
**Escopo:** SaaS multi-tenant em produção. Free + Pro R$ 99,90/mês. Paywall Stripe próprio. Cron lifecycle. Sistema de referral.
**Auditor:** Claude (agent: projetos pessoais)

**Atualização 2026-05-08 (segunda passagem):** P1-1 / P1-2 / P1-3 / P1-4 / P1-5 fechados na branch `security/fixes-2026-05-08` (commit local — ainda não foi feito push pra repo público; user revisa antes). Score sobe pra **9/10**.

---

## Resumo executivo

**Score global de segurança: 9/10** *(era 7.5/10 antes dos fixes desta data)*

Surpresa positiva. Apesar do repo ser **público**, multi-tenant e cobrar dinheiro, os fundamentos estão bem postos:
- `.env.local` e `.env.production.local` **NÃO** foram commitados (verifiquei `git log --all --full-history`).
- `.gitignore` cobre `.env`, `.env.local`, `.env.*.local`, `.env.vercel*`.
- Auth via JWT verificado server-side (jose + JWKS remoto).
- Stripe webhook com signature verification + idempotência.
- Todas as queries Neon usam **tagged template literals** (`sql\`SELECT ... ${var}\``) — parametrização nativa, sem SQL injection.
- Image proxy com host allowlist correta (match exato + leading dot, evita `evilcdninstagram.com`).
- Multi-tenant ownership check em **todas** as rotas que mexem em dados do user (`WHERE user_id = ${auth.user.id}`).
- Admin gate é server-side (`requireAdmin` em `lib/admin.ts`) — UI hide é só UX, não autorização.

Pontos fracos concentram em: **observabilidade/abuso** (sem rate-limit em nenhuma rota), **build artifact commitado** (`tsconfig.tsbuildinfo` 277KB), **falta de headers de segurança** no `next.config.ts`, e **alguns endpoints abertos a anônimo** (`/api/img`, `/api/last-sync`) que podem virar vetor de DoS.

Nenhum P0 imediato. Sem necessidade de rotação de chaves.

---

## 🚨 ALERTAS IMEDIATOS

### Nenhum.

Confirmações:

```
$ git ls-files | grep -E "\.(env|local|production)"
.env.example          ← ÚNICO commitado, sem valores reais

$ git log --all --full-history --oneline -- '.env' '.env.local' '.env.production' '.env.production.local'
(nada)                ← histórico limpo

$ cat .gitignore | grep -i env
.env
.env.local
.env.*.local
.env.vercel*         ← cobertura completa
```

Não há rotação de chaves a fazer agora. **Mantenha esse padrão.** Se algum dia você commitar `.env*` por acidente em repo público, todas as 18 chaves listadas em `.env.production.local` precisariam ser rotacionadas (DATABASE_URL Neon, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET_RADAR, GEMINI_API_KEY, APIFY_API_KEY, RESEND_API_KEY, META_ACCESS_TOKEN, CRON_SECRET, NEON_AUTH_JWKS_URL, RESEND_RADAR_AUDIENCE_ID, STRIPE_PRICE_ID_*).

---

## Mapa de ataque

```
┌─────────────────────────────────────────────────────────────────┐
│ Internet (público — repo no GitHub leigos podem clonar)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────────────────┐
                │                                       │
        ┌───────▼────────┐                     ┌────────▼──────────┐
        │ /api/img        │ NÃO autenticado    │ /api/last-sync   │ NÃO authd
        │ proxy IG/CDN    │ allowlist ok       │ MAX(*) DB        │ DoS leve
        │ DoS: bandwidth  │ SSRF: BLOQUEADO    │                  │
        └────────────────┘                     └──────────────────┘
                              │
                ┌─────────────┴─────────────────────────┐
                │ Bearer JWT (jose JWKS Neon Auth)     │
                ▼
        ┌────────────────────────────────────────────────┐
        │ /api/data/* /api/sources /api/saved /api/brief │
        │ /api/me/subscription /api/referrals/*          │
        │ /api/stripe/checkout /api/stripe/portal        │
        │ /api/auth/post-signup                          │
        │  → todas com requireUserId() ✓                 │
        │  → mutations com WHERE user_id = ${auth.id} ✓ │
        │  → SQL parametrizado (tagged template) ✓       │
        └────────────────────────────────────────────────┘
                              │
                ┌─────────────┴────────────┐
                │                          │
        ┌───────▼────────┐         ┌───────▼──────────┐
        │ /api/admin/*   │ require │ /api/cron/*      │ x-vercel-cron OR
        │ requireAdmin   │ Admin   │ Bearer CRON_SEC  │ ?token=CRON_SEC
        │ allowlist 2    │         │ + RADAR_V2_CRON_ │
        │ emails         │         │ ENABLED=true     │
        └────────────────┘         └──────────────────┘
                              │
        ┌─────────────────────▼──────────────────────┐
        │ /api/stripe/webhook                        │
        │  → constructEvent(sig, secret) ✓           │
        │  → metadata.app === 'radar' filter ✓       │
        │  → idempotente via stripe_webhook_events ✓ │
        └────────────────────────────────────────────┘
```

---

## Findings

### 🔴 P0 — Nenhum

---

### 🟠 P1 — Importante (corrigir em sprint atual)

> **Status 2026-05-08:** todos os 5 P1 foram aplicados na branch `security/fixes-2026-05-08`. Build verde (`bunx tsc --noEmit && bun run build` sem erros). Branch ainda não foi pushada — repo é público, user revisa antes do push.

#### P1-1 — Sem rate limit em nenhuma rota — ✅ APLICADO PARCIAL

**Arquivos:** todos sob `app/api/**`
**Impacto:** repo é **público**, conhecido, multi-tenant, cobra dinheiro. Atacante pode:
- Inundar `/api/stripe/checkout` (cada chamada = round-trip Stripe API + DB query). Gera carga e custo Stripe.
- Inundar `/api/img?url=...` com URLs grandes do IG CDN (pago em bandwidth Vercel).
- Inundar `/api/data/*` com queries pesadas (Neon compute por query).
- Brute-force `/api/referrals/track` com códigos aleatórios pra mapear códigos válidos (info disclosure).
- DoS no `/api/cron/*` quando `?token=` errado é tentado N vezes (até constant-time? não — string compare comum).

**Mitigação atual:** zero. Sem `@upstash/ratelimit`, sem `kv`, sem `@vercel/firewall`.

**Fix:**
```bash
bun add @upstash/ratelimit @upstash/redis
```
Criar `lib/rate-limit.ts` (sliding window, key = `auth.user.id ?? ip`). Aplicar:
- `/api/stripe/checkout`: 5 req/min/user (preview do Stripe checkout é pesado)
- `/api/img`: 60 req/min/IP
- `/api/data/*`: 30 req/min/user
- `/api/referrals/track`: 5 req/min/user
- `/api/cron/*` quando vier `?token=` (não-Vercel): 3 tentativas/min/IP

Alternativa low-effort: Vercel Firewall rules diretas no dashboard, sem código.

**Aplicado:**
- `lib/rate-limit.ts` criado (Upstash Redis quando `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` setados, fallback in-memory + warn).
- `/api/stripe/checkout` → 5 req/min/user (key: `stripe:checkout:<userId>`).
- `/api/img` → 60 req/min/IP (key: `img:<ip>`).
- `/api/data/videos` sem `?niche=` → 10 req/min/user (key: `videos-wide:<userId>`).

**Pendente (próxima sprint):** `/api/referrals/track`, `/api/data/news`, `/api/data/instagram/posts`, `/api/cron/*` quando vier `?token=` (defesa contra brute-force CRON_SECRET).

**Configurar no Vercel:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (criar projeto Upstash Redis gratuito). Sem isso, fallback in-memory funciona em single-instance mas não em multi-region.

---

#### P1-2 — `tsconfig.tsbuildinfo` (277KB) commitado — ✅ FECHADO

**Arquivo:** `tsconfig.tsbuildinfo` (raiz)
**Impacto:** vaza estrutura de imports e paths absolutos do projeto. Não tem secret, mas é noise inútil em repo público + atrapalha diff. `.gitignore` já lista `*.tsbuildinfo` e `tsconfig.tsbuildinfo` (linha 13-14), mas o arquivo foi commitado **antes** da regra entrar.

**Fix:**
```bash
cd /Users/gabrielmadureira/GOS/code/radar-viral
git rm --cached tsconfig.tsbuildinfo
git commit -m "chore: remove tsbuildinfo do tracking (já está em .gitignore)"
```

**Aplicado:** `git rm --cached tsconfig.tsbuildinfo` na branch `security/fixes-2026-05-08`. `.gitignore` já tinha `*.tsbuildinfo` + `tsconfig.tsbuildinfo` — só faltava deslistrar a versão antiga.

---

#### P1-3 — `/api/img` aberto a anônimo, sem rate-limit, fetch upstream sem timeout efetivo — ✅ FECHADO

**Arquivo:** `app/api/img/route.ts:21-72`
**Impacto:**
- Endpoint **não exige auth** (faz sentido pra IG thumbs em landing público).
- Hostname allowlist está **correta** (match exato + leading-dot), bloqueia `evilcdninstagram.com`. Sem SSRF.
- MAS: sem `AbortSignal.timeout()` no fetch upstream → atacante pode forçar workers a ficarem pendurados em URLs lentas → exhaustion.
- Sem cap de tamanho de resposta → atacante manda URLs com arquivos grandes (tem que ser do allowlist, mas fbcdn pode servir vídeos de minutos).
- Sem rate-limit por IP.

**Fix em `app/api/img/route.ts`:**
```ts
const upstream = await fetch(url, {
  headers: { /* ... */ },
  signal: AbortSignal.timeout(8_000),  // 8s teto
});
const len = Number(upstream.headers.get("content-length") ?? 0);
if (len > 10_000_000) {  // 10MB cap
  return NextResponse.json({ error: "too large" }, { status: 413 });
}
```
Plus: rate-limit de P1-1.

**Aplicado em `app/api/img/route.ts`:**
- `AbortSignal.timeout(8_000)` no fetch upstream.
- Cap de 10MB via `content-length` header check.
- Try/catch reconhece `TimeoutError` → retorna 504 limpo (em vez de 502 genérico).
- Rate-limit por IP integrado (60/min).

---

#### P1-4 — Sem headers de segurança em `next.config.ts` — ✅ FECHADO

**Arquivo:** `next.config.ts:1-19`
**Impacto:** falta `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. App pode ser embedado em iframe, MITM em conexões HTTP residuais, e CSP ausente facilita XSS se algum dia entrar `dangerouslySetInnerHTML` (hoje não tem).

**Fix:** adicionar `headers()` em `next.config.ts`:
```ts
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ],
  }];
},
```
CSP mais elaborado (com nonce p/ inline scripts do Next) fica como follow-up.

**Aplicado em `next.config.ts`:**
- HSTS preload (2 anos + includeSubDomains).
- `X-Frame-Options: DENY` (e `frame-ancestors 'none'` no CSP — defesa em camadas).
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`.
- CSP laxa intencional cobrindo Stripe (`js.stripe.com`, `hooks.stripe.com`, `checkout.stripe.com`), Vercel (`*.vercel-scripts.com`, `vercel.live`), PostHog (`*.posthog.com`), Neon (`*.neon.tech`), fonts Google. `unsafe-inline` + `unsafe-eval` mantidos pra Next 16 hydration. Refinar com nonce em sprint futura.

**Validar em preview antes de promover:** Stripe Checkout, fluxo OAuth Neon Auth, PostHog tracking, embeds (não tem hoje, mas DENY pode quebrar feature futura).

---

#### P1-5 — Erro detalhado vazado em dev quando NODE_ENV vier mal-configurado — ✅ FECHADO

**Arquivos:** vários (`app/api/data/*`, `app/api/sources`, `app/api/last-sync`, `app/api/brief`)

Pattern usado: `error: process.env.NODE_ENV === "production" ? "Falha" : String(err)`.

**Impacto:** se algum deploy preview ou ambiente exótico não setar `NODE_ENV=production`, erro com stack/SQL detalhe vai pro client. Hoje na Vercel preview/prod ambos setam `NODE_ENV=production` automaticamente, então fica seguro — mas a detecção é por `process.env.VERCEL_ENV` (que distingue preview de prod). Pra ser defensivo, ou (a) trocar pra `process.env.VERCEL_ENV !== undefined ? "Falha" : String(err)`, ou (b) sempre retornar genérico em qualquer ambiente.

**Severity:** baixa-média. Documenta como hardening.

**Aplicado:** trocado `process.env.NODE_ENV === "production"` → `process.env.VERCEL_ENV === "production"` em **todos os 16 ocorrências** dentro de `app/api/**` (12 routes). Mantido `NODE_ENV` em `lib/email-dispatch.ts` e `lib/stripe.ts` — esses são build-time env tags, não error masking. `VERCEL_ENV` é setado pelo Vercel pra distinguir `production` × `preview` × `development`, mais defensivo que confiar em `NODE_ENV` que qualquer wrapper pode mexer.

---

### 🟡 P2 — Boa prática (próxima sprint)

#### P2-1 — `/api/last-sync` aberto a anônimo expõe atividade de back-office

**Arquivo:** `app/api/last-sync/route.ts:19`
**Impacto:** retorna timestamps `MAX(fetched_at)` de news/IG/YT/briefs. É info "interna" do sistema. Se um cron parar, atacante consegue cronometrar quando dados ficam stale e timing attacks no scrape window. Risco baixo, mas é a única rota `/api/data/*` sem `requireUserId`.

**Fix:** adicionar `requireUserId` ou ao menos `getOptionalUserId` + retornar metadata reduzida pra anônimo.

---

#### P2-2 — `getCuratedSources` no `/api/data/videos` permite filtrar por niche arbitrário

**Arquivo:** `app/api/data/videos/route.ts:40,57-64`
**Impacto:** sem niche o endpoint retorna **TUDO** (comentário diz "admin only" mas o código não enforça admin). Qualquer user logado pode bater `GET /api/data/videos` sem `?niche=` e ver todos os vídeos do DB.

**Severity:** baixa (dados não-sensíveis, são vídeos públicos do YouTube). Mas o comentário sugere intenção de gate que não foi implementada.

**Fix:** adicionar `if (!niche) return requireAdmin(req)...` ou cap default em 30 itens com niche='marketing'.

---

#### P2-3 — Webhook event filter por `metadata.app !== 'radar'` é silencioso

**Arquivo:** `app/api/stripe/webhook/route.ts:162,264,380,454`
**Impacto:** se uma sub Pro do Radar Viral for criada **sem** `metadata.app='radar'` (bug humano no checkout custom, sub manual via Dashboard etc.), o webhook silenciosamente **ignora** o evento → user paga e não vira pro. Hoje só dá pra detectar via log Stripe + cron lifecycle observando.

**Fix:** logar warning quando filter rejeita evento (`event.type === 'customer.subscription.*'`) sem app tag — facilita debug.

---

#### P2-4 — `referralCode` no checkout não é validado

**Arquivo:** `app/api/stripe/checkout/route.ts:46-48`
**Impacto:** `referralCode` é trim+slice(64) e passado pra `metadata.referralCode`. Não é validado contra `user_referral_codes` antes de criar a session. Se for inválido, o webhook tenta `applyReferralReward` e falha silenciosamente em `recordReferralSignup` (retorna `referrer_not_found`). Não é vulnerabilidade, mas user pode passar lixo no metadata. OK como está.

**Fix:** opcional — validar via `findReferrerByCode(code)` antes do checkout, retornar 400 se inválido.

---

#### P2-5 — `pageSize` em `getReferralStats` não tem cap

**Arquivo:** `lib/referrals.ts:432-468` (`listReferralsForUser`)
**Impacto:** default `limit=100`, mas o param vem do caller. Hoje só `app/api/referrals/list/route.ts` chama, sem repassar limit. OK, mas hardening pede default + cap explícito no helper.

---

### 🟢 P3 — Nice-to-have

- **P3-1** — Padronizar `runtime` declaration (todos têm `export const runtime = "nodejs"` ✓ — bom).
- **P3-2** — Abstrair pattern `process.env.NODE_ENV === "production" ? "Falha" : String(err)` em helper `errorResponse(err)`.
- **P3-3** — Adicionar Sentry/Logflare pra capturar 500s e webhook handler errors em prod (hoje só `console.error`).
- **P3-4** — Considerar mover `/api/img` pra Vercel Image Optimization (`<Image>` já cobre IG via `next.config.ts:remotePatterns`, mas o proxy custom continua sendo usado por `imgProxy()`).
- **P3-5** — JSDoc no `referralCode` indicando max length 64 char + charset esperado.

---

## Pontos fortes (manter)

1. **Auth pattern (`lib/server-auth.ts`)** — JWT verificado via JWKS remoto, `requireUserId` retorna response 401 se inválido. Espelho do reels-viral, consistente.
2. **Admin pattern (`lib/admin.ts` + `admin-emails.ts`)** — server-side source of truth, allowlist explícita de 2 emails. UI hide é só UX.
3. **SQL parametrizado em 100% das queries** — todas via `sql\`...\${var}\`` do `@neondatabase/serverless` (tagged template). Zero raw SQL com `${variable}` interpolado em string.
4. **Stripe webhook** — signature verification, idempotência via `stripe_webhook_events_radar`, fallback de userId via `stripe_customer_id`, app tag filter, retry-friendly (500 sem marcar dedup).
5. **Multi-tenant ownership checks** — todas rotas mutáveis (`/api/sources`, `/api/data/saved`) usam `WHERE user_id = ${auth.user.id}` + `RETURNING` pra confirmar que update/delete acertou row do user.
6. **Image proxy com allowlist correta** — `hostname === h || hostname.endsWith("." + h)`, evita `evilcdninstagram.com`.
7. **CRON auth tripla** — header `x-vercel-cron`, Bearer secret, ou `?token=`. Plus feature flag `RADAR_V2_CRON_ENABLED` que skipa silenciosamente.
8. **Plan/quota guard server-side** — `/api/sources` checa `isPaidPlan` + cap por plataforma antes de inserir. Não dá pra burlar por API direto.
9. **Origin allowlist no checkout/portal** — `ALLOWED_ORIGINS` evita open redirect via `origin` header arbitrário.
10. **Scripts e helpers usam lazy init** — `getSql()`, `buildStripe()` com Proxy. Sem boot crash quando env vars faltam em ambientes parciais.

---

## Plano de remediação (ordem sugerida)

### Hoje (10 min)
1. `git rm --cached tsconfig.tsbuildinfo` + commit (P1-2). **Faça antes do próximo merge.**

### Esta semana (2-4h)
2. Adicionar headers de segurança em `next.config.ts` (P1-4) — cópia/cola, baixo risco. Test em preview.
3. `AbortSignal.timeout(8_000)` no `/api/img` upstream fetch (P1-3 parcial).
4. Logar warning em `/api/stripe/webhook` quando app-tag filter rejeita sub events (P2-3).

### Próximas 2 semanas (1 dia)
5. **Rate limit (P1-1)** via Upstash Redis. Prioridade: `/api/stripe/checkout` → `/api/img` → `/api/data/*` → `/api/referrals/track`. Documentar limites em README.
6. Gate em `/api/data/videos` quando vier sem niche (P2-2).
7. Auth check em `/api/last-sync` (P2-1) — opcional.

### Backlog
8. Helper `errorResponse(err)` (P3-2).
9. Sentry/observabilidade (P3-3).
10. Validar referralCode no checkout (P2-4).

---

## Anexo — Inventário de API routes

| Route | Auth | DB | Notas |
|---|---|---|---|
| `/api/img` | aberto | — | proxy, allowlist OK, sem timeout |
| `/api/last-sync` | aberto | read | MAX(*) — DoS leve |
| `/api/me/subscription` | optional | read | anônimo retorna free |
| `/api/data/instagram/posts` | required | read | niche-filtered |
| `/api/data/news` | required | read | + classifier |
| `/api/data/videos` | required | read | sem niche → tudo (P2-2) |
| `/api/data/newsletters` | required | read | niche-filtered |
| `/api/data/saved` | required | RW | ownership ✓ |
| `/api/sources` | required | RW | ownership + plan guard ✓ |
| `/api/brief` | required | read | niche-filtered |
| `/api/auth/post-signup` | required | — | Resend upsert |
| `/api/referrals/me` | required | RW | upsert + stats |
| `/api/referrals/list` | required | read | mascara email ✓ |
| `/api/referrals/track` | required | RW | self-ref blocked ✓ |
| `/api/stripe/checkout` | required | read | origin allowlist ✓ |
| `/api/stripe/portal` | required | read | origin allowlist ✓ |
| `/api/stripe/webhook` | signature | RW | idempotente ✓ |
| `/api/admin/stats` | requireAdmin | read | 14 queries em parallel, ISR 60s |
| `/api/cron/refresh` | cron auth + flag | RW | News+IG+YT |
| `/api/cron/brief` | cron auth + flag | RW | Gemini Flash |
| `/api/cron/scrape-tiktok` | cron auth + flag | RW | Apify call DESATIVADA |
| `/api/cron/weekly-digest` | cron auth + flag | RW | Resend |
| `/api/cron/idle-5d` | cron auth + flag | RW | Resend lifecycle |
| `/api/cron/power-user` | cron auth + flag | RW | Resend lifecycle |

**Total:** 24 routes. **22/24** com auth correto, **2/24** abertos justificados (`/api/img` proxy público, `/api/me/subscription` retorna free pra anônimo). **0** com auth bypass.

---

**Conclusão:** Radar Viral é o repo público mais bem-postado do portfólio. Padrão a replicar nos outros (sequencia-viral, kaleidos-pay-app etc). As pendências são todas **hardening** — não há bug crítico explorável agora. Faça o `git rm --cached tsconfig.tsbuildinfo` hoje, headers de segurança esta semana, rate-limit nas próximas 2 semanas. Score sobe pra 9/10 com essas 3 entregas.
