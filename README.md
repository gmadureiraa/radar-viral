# Radar Viral

> Inteligência diária cross-platform — IG · YouTube · notícias · newsletters. Brief IA + temas em alta.

**Versão oficial** desde 2026-05-01 (Next 16 + sidebar fixed + design alinhado a Sequência Viral / Reels Viral · cream + REC coral + brutalist).

**v1 legacy** preservada em `code/_archive/viral-hunter-v1-legacy/` (Vite + Cream & Lime original) — Gabriel mantém por gosto pessoal e ainda viva em prod via cron até paridade total nesta versão.

## Sucessão gradual

| Módulo | Status v2 |
|---|---|
| Dashboard (Brief IA + Temas + Narrativas + Ideias) | ✅ pronto |
| Niche switcher | 🟡 pendente |
| Instagram, YouTube, News, Newsletters, Saved, Settings, Admin | 🟡 placeholders linkando v1 |
| Crons (refresh / brief / newsletters) | 🟡 ainda na v1 — quando migrar, desativar v1 prod |

A v2 lê do **mesmo Neon DB** que v1 popula via cron. Zero risco pra dados durante a transição.

---

## Stack

- **Next.js 16** App Router + Turbopack
- **React 19** + TypeScript strict
- **Tailwind CSS 4** (zero JS config, `@theme` em CSS puro)
- **Bun** runtime + package manager
- **Neon Postgres** (compartilhado com v1)
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
    instagram/page.tsx      # → ComingSoon (link pra v1)
    youtube/page.tsx        # → ComingSoon
    news/page.tsx           # → ComingSoon
    newsletters/page.tsx    # → ComingSoon
    saved/page.tsx          # → ComingSoon
    settings/page.tsx       # → ComingSoon
    admin/page.tsx          # → ComingSoon (admin only via sidebar guard)

  api/
    brief/route.ts          # GET /api/brief?niche= — lê daily_briefs do v1

components/
  auth-dialog.tsx           # Email + Google OAuth
  coming-soon.tsx           # Placeholder com link pra v1

lib/
  auth-client.ts            # Neon Auth lazy + getJwtToken via getSession()
  server-auth.ts            # JWT verify via JWKS (jose)
  admin-emails.ts           # client-side admin check (UX only)
```

## Estado atual

| Módulo | Status |
|---|---|
| Landing pública | ✅ pronta (hero + AuthDialog + stats + CTA) |
| Login Email/Google | ✅ funcional |
| Sidebar layout | ✅ sticky desktop + mobile drawer |
| Dashboard com Brief IA | ✅ MVP — temas em alta com ranking + sinal-meter, narrativas, ideias |
| Instagram/YouTube/News/Newsletters/Saved/Settings/Admin | 🟡 placeholders com link "Abrir na v1" |

A v2 **lê** do mesmo Neon DB que o v1 popula via cron. **Não há cron próprio na v2** — quando todas as páginas estiverem migradas, podemos decidir se vamos consolidar ou manter o split.

## Setup

```bash
cd code/radar-viral-v2
cp .env.example .env.local
# preenche DATABASE_URL, NEON_AUTH_*, APIFY_API_KEY (opcional pra leitura),
# CRON_SECRET, NEXT_PUBLIC_SITE_URL

bun install
bun run dev    # http://localhost:3000
```

## Env vars

```bash
DATABASE_URL=                          # mesmo do v1 (postgres://...neon...)
NEXT_PUBLIC_NEON_AUTH_URL=             # mesmo do v1
NEON_AUTH_JWKS_URL=                    # mesmo do v1
APIFY_API_KEY=                         # opcional (só se v2 implementar scrape)
GEMINI_API_KEY=                        # opcional
CRON_SECRET=                           # opcional
NEXT_PUBLIC_SITE_URL=https://radar.kaleidos.com.br
```

## Deploy

Vercel project separado de `viral-hunter` (v1). Sugerido:
- Project name: `radar-viral-v2`
- Domain alvo: `radar2.kaleidos.com.br` (ou previews) até validar paridade
- Quando paridade estiver feita: trocar alias de `radar.kaleidos.com.br` pra v2 e arquivar v1

## Próximos passos sugeridos

1. **Niche switcher** no sidebar (cripto / marketing / IA)
2. **Migrar IG Radar** primeiro (página mais usada da v1)
3. **News + Newsletters** depois (lóğica simples, leitura pura)
4. **YouTube** + canal hub
5. **Saved** (cross-platform bookmark)
6. **Settings** + admin

Cada módulo: ler do mesmo DB, design refeito com sidebar.
