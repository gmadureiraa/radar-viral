# Radar Viral v2 — Cron Cutover

Como migrar a operação de cron do v1 legacy (`viral-hunter-phi` na Vercel)
pro v2 (`radar-viral`) sem perder dados.

## Estado atual

- **v1 legacy** (`code/_archive/viral-hunter-v1-legacy/`) ainda popula o
  mesmo Neon DB via crons na `viral-hunter-phi`. v2 só **lê**.
- **v2** (`code/radar-viral/`) tem todos os crons portados:
  - `/api/cron/refresh` 09:00 UTC: news + IG global + IG per-user (Pro/Max) + YT global + YT per-user (Pro/Max)
  - `/api/cron/brief` 10:50 UTC
  - `/api/cron/scrape-tiktok` 11:00 UTC: Pro+Max
  - `/api/cron/weekly-digest`, `/api/cron/idle-5d`, `/api/cron/power-user`
- Todos os crons checam `RADAR_V2_CRON_ENABLED=true` antes de rodar.
  Default = não roda (silent skip).

## Idempotência (já garantida)

Todos os INSERT dos crons têm `ON CONFLICT ... DO UPDATE`:
- `news_articles` → `(link)`
- `instagram_posts` → `(shortcode)`
- `videos` → `(video_id)`
- `tiktok_posts` → `(post_id)`

Logo, rodar v1 e v2 em paralelo NÃO duplica dados — só atualiza
métricas. Cutover pode ser feito sem janela de manutenção.

## Passos pra ativar v2 cron em prod

1. **Setar env vars na Vercel** (project `radar-viral`):
   - `RADAR_V2_CRON_ENABLED=true`
   - `CRON_SECRET=<mesmo do v1, ou novo>`
   - `DATABASE_URL=<Neon do v1>`
   - `APIFY_API_KEY=<mesma conta Apify do v1>`
   - `GEMINI_API_KEY=<mesma>`
   - `TIKTOK_SCRAPE_DISABLED=false` (default — só setar `true` pra freio)

2. **Smoke test em dry-run** (não dispara Apify):
   ```bash
   curl 'https://radar-viral.vercel.app/api/cron/refresh?dry=true&token=$CRON_SECRET'
   curl 'https://radar-viral.vercel.app/api/cron/scrape-tiktok?dry=true&token=$CRON_SECRET'
   ```
   Espera: `news_sources`, `ig_bundles`, `ig_user_bundles`, `paid_user_handles` populados.

3. **Run real manual** (1x):
   ```bash
   curl 'https://radar-viral.vercel.app/api/cron/refresh?token=$CRON_SECRET'
   ```
   Confere `summary.ig_inserted`, `ig_user_inserted`, `youtube_inserted`,
   `youtube_user_inserted` no JSON. Confere `cron_run_log` no Neon:
   ```sql
   SELECT cron_type, user_id, posts_added, status, ran_at
     FROM cron_run_log
    WHERE ran_at > NOW() - INTERVAL '10 min'
    ORDER BY ran_at DESC;
   ```

4. **Aguardar 24h** rodando em paralelo com v1. Conferir que:
   - `cron_run_log` tem entries `cronType='refresh-ig-user'` e
     `'refresh-yt-user'` pros users Pro
   - Posts IG/YT continuam atualizando (compare timestamps `fetched_at` e
     `last_seen_at` no DB)
   - Custos Apify não estouraram (dashboard apify.com)

5. **Desligar v1**: na Vercel, no project `viral-hunter-phi`, ou
   - Setar `RADAR_V2_CRON_ENABLED=false` lá (se v1 também respeita) OU
   - Pausar os crons em Settings > Cron Jobs OU
   - Despromover deploy de prod (env vars somem)

6. **Trocar domínio**: alias `radar.kaleidos.com.br` aponta hoje pra
   `viral-hunter-phi`. Mover pra `radar-viral`:
   ```bash
   vercel alias set radar-viral.vercel.app radar.kaleidos.com.br
   ```

## Como monitorar

**Painel admin v2** (`/app/admin`) já tem widget de cron_run_log.

Query útil pra ver custos per-user:
```sql
SELECT user_id,
       cron_type,
       COUNT(*) AS runs,
       SUM(posts_added) AS posts,
       MAX(ran_at) AS last_run
  FROM cron_run_log
 WHERE ran_at > NOW() - INTERVAL '7 days'
   AND cron_type IN ('refresh-ig-user','refresh-yt-user','scrape-tiktok')
 GROUP BY user_id, cron_type
 ORDER BY posts DESC;
```

Alerta de stall: se nenhum cron tipo `refresh-news` rodou nas últimas
26h, algo travou (espera-se 1/dia 09:00 UTC).

## Rollback

Se algo der errado depois do cutover:

1. **Reativar v1** instantaneamente: redeploy do projeto `viral-hunter-phi`
   na Vercel (último deploy bom continua disponível) + alias volta.
2. **Pausar v2**: setar `RADAR_V2_CRON_ENABLED=false` na Vercel do
   `radar-viral`. Crons continuam agendados mas saem com `skipped`.
3. **Kill-switch TikTok** (se custo Apify explodiu): setar
   `TIKTOK_SCRAPE_DISABLED=true`. Não precisa redeploy — Vercel injeta
   env vars no próximo run.

## Riscos conhecidos

- **YouTube per-user resolução de channelId**: hoje `tracked_sources.handle`
  precisa começar com `UC...`. Se user adicionou pelo @handle, o cron
  skipa silencioso. UI precisa resolver no submit (TODO out-of-scope).
- **Cap defensivo IG per-user**: 450 posts/run/user worst-case. Em 30
  runs/mês × 1 user Pro = 13.500 posts × \$0.000346 = ~\$4,67/user/mês.
  Margem Pro R\$ 99,90 ainda saudável (~80%), mas monitorar.
- **TikTok Apify quota**: kill-switch existe mas é manual. Considerar
  alerta automático se `cron_run_log.posts_added` somar > X em 24h.
