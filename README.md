# Radar Viral

> Inteligência diária cross-platform — IG · YouTube · notícias · newsletters. Brief IA + temas em alta.

**Versão oficial e única em produção** desde o cutover de 2026-05-08 (Next 16 + sidebar fixed + design alinhado a Sequência Viral / Reels Viral · cream + REC coral + brutalist). Domínio prod: `radar.kaleidos.com.br`.

> A v1 legacy (`viral-hunter`, Vite + Cream & Lime) foi **descontinuada e removida** em 2026-05-08 — Vercel project, repos GitHub e pasta local apagados. "Radar Viral" é o nome canônico daqui pra frente; "Viral Hunter" não existe mais.

## Módulos

| Módulo | Status |
|---|---|
| Dashboard (Brief IA + Temas + Narrativas + Ideias) | ✅ |
| Niche switcher | ✅ |
| Instagram, YouTube, News, Newsletters, TikTok, Threads, Trends, Saved, Settings, Admin | ✅ |
| Referrals (indique-e-ganhe) | ✅ |
| Billing (Stripe checkout/portal/webhook) | ✅ |
| Crons (refresh / brief / scrape-tiktok / scrape-threads / weekly-digest / idle-5d / power-user) | ✅ rodando neste projeto via `vercel.json` |

Plataformas suportadas: Instagram, YouTube, TikTok, Threads, RSS, Newsletter. X/Twitter foi removido em 2026-05-08 (rotas `/api/cron/scrape-twitter` e `/api/data/twitter` ficam como stubs desativados pra evitar 404 em clients legados).

---

## Stack

- **Next.js 16** App Router + Turbopack
- **React 19** + TypeScript strict
- **Tailwind CSS 4** (zero JS config, `@theme` em CSS puro)
- **Bun** runtime + package manager
- **Neon Postgres** (dedicado)
- **Neon Auth** (Better Auth) — mesmo provider do RV
- `jose` pra validação JWT server-side
- `framer-motion` + `sonner` + `lucide-react`

## Design

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-rdv-paper` | `#F5F1E8` | bg principal (cream celuloide) |
| `--color-rdv-cream` | `#FBF7EE` | bg de cards |
| `--color-rdv-ink` | `#0A0908` | texto + bordas + sidebar |
| `--color-rdv-rec` | `#FF3D2E` | acento principal (REC coral) |
| `--color-rdv-amber` | `#F0B33C` | secundário |

- **Sans:** Plus Jakarta Sans
- **Display:** Instrument Serif italic (headings)
- **Mono:** Geist Mono (eyebrows, timestamps)

Brutalist shadows `4px 4px 0 0 ink` em buttons e cards. Pulsing REC dot em todas as eyebrows.

## Estrutura

```
app/
  page.tsx                  # / — landing pública (hero + login)
  layout.tsx                # root: fonts + Toaster
  globals.css               # @theme + componentes (.rdv-*)

  app/                      # /app — autenticado
    layout.tsx              # sidebar fixed (ink+REC) + auth gate
    page.tsx                # /app — dashboard com Brief IA + temas + ideias
    instagram/page.tsx      # Radar IG por nicho
    youtube/page.tsx        # catálogo curado global
    news/page.tsx           # notícias classificadas
    newsletters/page.tsx    # feed compartilhado (Gmail)
    tiktok/page.tsx         # Radar TikTok
    threads/page.tsx        # Radar Threads
    trends/page.tsx         # temas em alta
    saved/page.tsx          # bookmarks cross-platform
    settings/page.tsx       # fontes, nichos, perfil
    settings/referrals/     # indique-e-ganhe
    onboarding/page.tsx     # primeiro acesso
    precos/page.tsx         # planos (Stripe)
    admin/page.tsx          # admin only via sidebar guard

  api/
    brief/route.ts          # GET /api/brief?niche= — lê daily_briefs
    cron/                   # refresh · brief · scrape-tiktok/threads · digests
    data/                   # leitura por plataforma
    stripe/                 # checkout · portal · webhook
    referrals/              # track · me · list

components/
  auth-dialog.tsx           # Email + Google OAuth

lib/
  auth-client.ts            # Neon Auth lazy + getJwtToken via getSession()
  server-auth.ts            # JWT verify via JWKS (jose)
  admin-emails.ts           # client-side admin check (UX only)
```

## Setup

```bash
cd code/radar-viral
cp .env.example .env.local
# preenche DATABASE_URL, NEON_AUTH_*, APIFY_API_KEY,
# CRON_SECRET, NEXT_PUBLIC_SITE_URL e chaves Stripe

bun install
bun run dev        # http://localhost:3000
bun run build      # build de produção
bun run typecheck  # tsc --noEmit
```

## Env vars

Ver `.env.example` pra lista completa. Principais:

```bash
DATABASE_URL=                          # Neon (postgres://...neon...)
NEXT_PUBLIC_NEON_AUTH_URL=             # Neon Auth
NEON_AUTH_JWKS_URL=                    # JWKS pra validação JWT
APIFY_API_KEY=                         # scrapes (TikTok/Threads/IG)
GEMINI_API_KEY=                        # brief IA + classificação
CRON_SECRET=                           # auth dos crons
STRIPE_SECRET_KEY=                     # billing
NEXT_PUBLIC_SITE_URL=https://radar.kaleidos.com.br
```

## Deploy

- **Vercel project:** `radar-viral`
- **Domain prod:** `radar.kaleidos.com.br`
- **Crons:** definidos em `vercel.json` (gated por `RADAR_V2_CRON_ENABLED`)

Não fazer deploy sem aprovação. `bun run build` + `bun run typecheck` devem passar limpos antes.
