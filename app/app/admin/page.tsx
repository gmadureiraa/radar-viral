"use client";

/**
 * /app/admin — painel admin do Radar Viral v2.
 *
 * 4 tabs:
 *  - Overview: KPIs + série diária 30d (posts coletados + briefs + custos)
 *  - Usuários: top 50 user_profiles com niche/sub/saved
 *  - Fontes: tracked_sources breakdown por platform/niche/global vs user
 *  - Assinaturas: Pro list + MRR
 *
 * Acesso: ADMIN_EMAILS (validação server em /api/admin/stats).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CreditCard,
  DollarSign,
  Loader2,
  Radio,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useNeonSession, getJwtToken } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin-emails";

type TabId = "overview" | "users" | "sources" | "subscriptions";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Activity size={13} /> },
  { id: "users", label: "Usuários", icon: <Users size={13} /> },
  { id: "sources", label: "Fontes", icon: <Radio size={13} /> },
  { id: "subscriptions", label: "Assinaturas", icon: <CreditCard size={13} /> },
];

interface AdminStats {
  summary: {
    totalUsers: number;
    totalProfiles: number;
    activeSubs: number;
    totalIgPosts: number;
    totalVideos: number;
    totalNews: number;
    totalNewsletters: number;
    ig30d: number;
    videos30d: number;
    news30d: number;
    newsletters30d: number;
    briefs30d: number;
    costGemini30d: number;
    costApify30d: number;
    totalCost30d: number;
    cronRuns30d: number;
  };
  planCounts: Record<string, number>;
  dailySeries: Array<{
    day: string;
    ig_posts: number;
    yt_videos: number;
    news: number;
    newsletters: number;
    briefs: number;
    cost: number;
  }>;
  sources: Array<{
    platform: string;
    niche: string;
    total: number;
    active: number;
    per_user: number;
    global: number;
  }>;
  users: Array<{
    user_id: string;
    email: string | null;
    display_name: string | null;
    role: string | null;
    status: string | null;
    last_login_at: string | null;
    niche: string | null;
    saved_count: number;
    plan: string | null;
    sub_status: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
  }>;
  subscriptions: {
    activeCount: number;
    mrrBrl: number;
    mrrUsd: number;
    list: Array<{
      user_id: string;
      email: string | null;
      plan: string;
      status: string;
      current_period_end: string | null;
      cancel_at_period_end: boolean;
      created_at: string;
    }>;
  };
  cronRuns: Array<{
    id: number;
    user_id: string | null;
    cron_type: string;
    niche_id: number | null;
    posts_added: number | null;
    status: string;
    error_msg: string | null;
    ran_at: string;
  }>;
  generatedAt: string;
}

export default function AdminPage() {
  const session = useNeonSession();
  const [tab, setTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useMemo(
    () => isAdminEmail(session.data?.user?.email),
    [session.data?.user?.email],
  );

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getJwtToken();
      const res = await fetch("/api/admin/stats", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 403) {
        setError("Acesso restrito — admin apenas");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AdminStats;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session.isPending) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session.isPending]);

  if (session.isPending) {
    return (
      <main style={pageBg}>
        <div style={centeredLoader}>
          <Loader2 size={24} className="rdv-spin" />
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main style={pageBg}>
        <div style={{ ...centeredLoader, flexDirection: "column", gap: 14 }}>
          <div className="rdv-eyebrow">
            <span className="rdv-rec-dot" /> ACESSO RESTRITO
          </div>
          <p style={{ color: "var(--color-rdv-muted)", fontSize: 14 }}>
            Esse painel é só pra admin.
          </p>
          <Link
            href="/app"
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "10px 16px" }}
          >
            <ArrowLeft size={12} /> Voltar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageBg}>
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1.5px solid var(--color-rdv-ink)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div className="rdv-eyebrow">
          <span className="rdv-rec-dot" /> ADMIN · RADAR VIRAL
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {stats?.generatedAt && (
            <span
              className="rdv-mono"
              style={{ fontSize: 9, color: "var(--color-rdv-muted)" }}
            >
              ATUALIZADO {fmtDateShort(stats.generatedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rdv-btn rdv-btn-ghost"
            style={{ padding: "8px 14px", fontSize: 10, letterSpacing: "0.16em" }}
          >
            <RefreshCw size={12} className={loading ? "rdv-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* TABS */}
      <div
        style={{
          padding: "16px 24px 0",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderBottom: "1px solid var(--color-rdv-line)",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="rdv-mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "10px 16px",
              background: "transparent",
              color:
                tab === t.id ? "var(--color-rdv-ink)" : "var(--color-rdv-muted)",
              border: "none",
              borderBottom: `2px solid ${
                tab === t.id ? "var(--color-rdv-rec)" : "transparent"
              }`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: -1,
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <section style={{ padding: "26px 24px 80px", maxWidth: 1280 }}>
        {error && (
          <div
            style={{
              padding: 16,
              border: "1.5px solid var(--color-rdv-rec)",
              background: "rgba(255, 61, 46, 0.08)",
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {loading && !stats && (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <Loader2 size={24} className="rdv-spin" />
          </div>
        )}

        {stats && tab === "overview" && <OverviewTab stats={stats} />}
        {stats && tab === "users" && <UsersTab stats={stats} />}
        {stats && tab === "sources" && <SourcesTab stats={stats} />}
        {stats && tab === "subscriptions" && <SubscriptionsTab stats={stats} />}
      </section>
    </main>
  );
}

// ─── OVERVIEW ───────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: AdminStats }) {
  const totalContent = stats.dailySeries.reduce(
    (acc, d) => acc + d.ig_posts + d.yt_videos + d.news + d.newsletters,
    0,
  );
  const maxContent = Math.max(
    ...stats.dailySeries.map(
      (d) => d.ig_posts + d.yt_videos + d.news + d.newsletters,
    ),
    1,
  );
  const maxBriefs = Math.max(...stats.dailySeries.map((d) => d.briefs), 1);
  const maxCost = Math.max(...stats.dailySeries.map((d) => d.cost), 0.01);
  const conversionRate =
    stats.summary.totalProfiles > 0
      ? (stats.summary.activeSubs / stats.summary.totalProfiles) * 100
      : 0;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="USUÁRIOS"
          value={fmtNum(stats.summary.totalProfiles)}
          hint={`${stats.summary.activeSubs} pagantes`}
          icon={<Users size={16} />}
        />
        <KpiCard
          label="MRR"
          value={fmtBrl(stats.subscriptions.mrrBrl)}
          hint={`${stats.subscriptions.activeCount} subs Pro`}
          icon={<TrendingUp size={16} />}
          accent
        />
        <KpiCard
          label="CONVERSÃO"
          value={`${conversionRate.toFixed(1)}%`}
          hint={`${stats.summary.activeSubs}/${stats.summary.totalProfiles} pagantes`}
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="CUSTO 30D"
          value={fmtUsd(stats.summary.totalCost30d)}
          hint={`Apify ${fmtUsd(stats.summary.costApify30d)} · IA ${fmtUsd(stats.summary.costGemini30d)}`}
          icon={<DollarSign size={16} />}
        />
        <KpiCard
          label="CONTEÚDO COLETADO"
          value={fmtNum(
            stats.summary.totalIgPosts +
              stats.summary.totalVideos +
              stats.summary.totalNews +
              stats.summary.totalNewsletters,
          )}
          hint={`${fmtNum(totalContent)} nos últimos 30d`}
          icon={<Zap size={16} />}
        />
        <KpiCard
          label="BRIEFS GERADOS 30D"
          value={fmtNum(stats.summary.briefs30d)}
          hint={`${stats.summary.cronRuns30d} cron runs`}
          icon={<Activity size={16} />}
        />
      </div>

      {/* Breakdown por tipo */}
      <Card title="Conteúdo por plataforma">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MiniStat
            label="Instagram"
            total={stats.summary.totalIgPosts}
            recent={stats.summary.ig30d}
          />
          <MiniStat
            label="YouTube"
            total={stats.summary.totalVideos}
            recent={stats.summary.videos30d}
          />
          <MiniStat
            label="Notícias"
            total={stats.summary.totalNews}
            recent={stats.summary.news30d}
          />
          <MiniStat
            label="Newsletters"
            total={stats.summary.totalNewsletters}
            recent={stats.summary.newsletters30d}
          />
        </div>
      </Card>

      {/* Daily charts */}
      <Card title="Atividade últimos 30 dias">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <BarChart
            label="Conteúdo coletado/dia (IG+YT+News+NL)"
            data={stats.dailySeries.map((d) => ({
              x: d.day,
              y: d.ig_posts + d.yt_videos + d.news + d.newsletters,
              raw: d.ig_posts + d.yt_videos + d.news + d.newsletters,
            }))}
            color="var(--color-rdv-ink)"
            max={maxContent}
            formatter={(v) => String(Math.round(v))}
          />
          <BarChart
            label="Briefs IA gerados/dia"
            data={stats.dailySeries.map((d) => ({
              x: d.day,
              y: d.briefs,
              raw: d.briefs,
            }))}
            color="var(--color-rdv-amber)"
            max={maxBriefs}
            formatter={(v) => String(Math.round(v))}
          />
          <BarChart
            label="Custo/dia (USD)"
            data={stats.dailySeries.map((d) => ({
              x: d.day,
              y: d.cost,
              raw: d.cost,
            }))}
            color="var(--color-rdv-rec)"
            max={maxCost}
            formatter={(v) => `$${v.toFixed(3)}`}
          />
        </div>
      </Card>
    </div>
  );
}

// ─── USERS ──────────────────────────────────────────────────────────────

function UsersTab({ stats }: { stats: AdminStats }) {
  return (
    <Card title={`Top 50 usuários por último acesso (${stats.users.length})`}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Plano</Th>
            <Th>Niche</Th>
            <Th align="right">Salvos</Th>
            <Th>Último acesso</Th>
            <Th>Período fim</Th>
          </tr>
        </thead>
        <tbody>
          {stats.users.map((u) => (
            <tr key={u.user_id}>
              <Td>
                <div style={{ display: "grid", gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    {u.display_name ?? u.email ?? "—"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--color-rdv-muted)",
                    }}
                  >
                    {u.email ?? `${u.user_id.slice(0, 10)}…`}
                  </span>
                </div>
              </Td>
              <Td>
                <PlanBadge plan={u.plan} status={u.sub_status} />
              </Td>
              <Td>
                <span
                  className="rdv-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--color-rdv-muted)",
                  }}
                >
                  {u.niche ?? "—"}
                </span>
              </Td>
              <Td align="right">{fmtNum(u.saved_count)}</Td>
              <Td>{fmtDateShort(u.last_login_at)}</Td>
              <Td>{fmtDateShort(u.current_period_end)}</Td>
            </tr>
          ))}
          {stats.users.length === 0 && (
            <tr>
              <Td colSpan={6} muted>
                Nenhum usuário ainda.
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

// ─── SOURCES ────────────────────────────────────────────────────────────

function SourcesTab({ stats }: { stats: AdminStats }) {
  const totals = stats.sources.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.active += s.active;
      acc.per_user += s.per_user;
      acc.global += s.global;
      return acc;
    },
    { total: 0, active: 0, per_user: 0, global: 0 },
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="TOTAL FONTES"
          value={fmtNum(totals.total)}
          hint={`${totals.active} ativas`}
          icon={<Radio size={16} />}
        />
        <KpiCard
          label="GLOBAIS (CURADAS)"
          value={fmtNum(totals.global)}
          hint="Radar compartilhado"
          icon={<Radio size={16} />}
        />
        <KpiCard
          label="PER-USER"
          value={fmtNum(totals.per_user)}
          hint="Subs Pro com cron"
          icon={<Users size={16} />}
          accent
        />
      </div>

      <Card title="Fontes por plataforma e nicho">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Platform</Th>
              <Th>Nicho</Th>
              <Th align="right">Total</Th>
              <Th align="right">Ativas</Th>
              <Th align="right">Globais</Th>
              <Th align="right">Per-user</Th>
            </tr>
          </thead>
          <tbody>
            {stats.sources.map((s, i) => (
              <tr key={`${s.platform}-${s.niche}-${i}`}>
                <Td>
                  <span
                    className="rdv-mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.platform}
                  </span>
                </Td>
                <Td>{s.niche}</Td>
                <Td align="right">{fmtNum(s.total)}</Td>
                <Td align="right">{fmtNum(s.active)}</Td>
                <Td align="right">{fmtNum(s.global)}</Td>
                <Td align="right">{fmtNum(s.per_user)}</Td>
              </tr>
            ))}
            {stats.sources.length === 0 && (
              <tr>
                <Td colSpan={6} muted>
                  Nenhuma fonte cadastrada ainda.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title={`Últimos cron runs (${stats.cronRuns.length})`}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Quando</Th>
              <Th>Tipo</Th>
              <Th>User</Th>
              <Th>Nicho</Th>
              <Th align="right">Posts +</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {stats.cronRuns.map((c) => (
              <tr key={c.id}>
                <Td>{fmtDateShort(c.ran_at)}</Td>
                <Td>
                  <span
                    className="rdv-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    {c.cron_type}
                  </span>
                </Td>
                <Td>
                  {c.user_id ? (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      {c.user_id.slice(0, 10)}…
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-rdv-muted)" }}>global</span>
                  )}
                </Td>
                <Td>{c.niche_id ?? "—"}</Td>
                <Td align="right">{c.posts_added ?? "—"}</Td>
                <Td>
                  <StatusBadge status={c.status} error={c.error_msg} />
                </Td>
              </tr>
            ))}
            {stats.cronRuns.length === 0 && (
              <tr>
                <Td colSpan={6} muted>
                  Nenhum cron rodou ainda.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── SUBSCRIPTIONS ──────────────────────────────────────────────────────

function SubscriptionsTab({ stats }: { stats: AdminStats }) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="ATIVAS"
          value={fmtNum(stats.subscriptions.activeCount)}
          icon={<CreditCard size={16} />}
        />
        <KpiCard
          label="MRR (BRL)"
          value={fmtBrl(stats.subscriptions.mrrBrl)}
          icon={<DollarSign size={16} />}
          accent
        />
        <KpiCard
          label="MRR (USD)"
          value={fmtUsd(stats.subscriptions.mrrUsd)}
          icon={<DollarSign size={16} />}
        />
      </div>

      <Card title="Assinaturas Pro">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Criado</Th>
              <Th>User</Th>
              <Th>Plano</Th>
              <Th>Status</Th>
              <Th>Período fim</Th>
              <Th>Cancelar?</Th>
            </tr>
          </thead>
          <tbody>
            {stats.subscriptions.list.map((s) => (
              <tr key={s.user_id}>
                <Td>{fmtDateShort(s.created_at)}</Td>
                <Td>
                  <div style={{ display: "grid", gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {s.email ?? "—"}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--color-rdv-muted)",
                      }}
                    >
                      {s.user_id.slice(0, 10)}…
                    </span>
                  </div>
                </Td>
                <Td>
                  <PlanBadge plan={s.plan} status={s.status} />
                </Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td>{fmtDateShort(s.current_period_end)}</Td>
                <Td>
                  {s.cancel_at_period_end ? (
                    <span
                      style={{
                        color: "var(--color-rdv-rec)",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ⚠ ao fim
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            ))}
            {stats.subscriptions.list.length === 0 && (
              <tr>
                <Td colSpan={6} muted>
                  Nenhuma assinatura ainda.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Auxiliares ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--color-rdv-cream)",
        border: `1.5px solid ${
          accent ? "var(--color-rdv-rec)" : "var(--color-rdv-ink)"
        }`,
        boxShadow: accent
          ? "6px 6px 0 0 var(--color-rdv-rec)"
          : "4px 4px 0 0 var(--color-rdv-ink)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--color-rdv-muted)",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              color: accent ? "var(--color-rdv-rec)" : "var(--color-rdv-ink)",
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className="rdv-display"
        style={{
          fontSize: 28,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          marginBottom: hint ? 4 : 0,
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--color-rdv-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  total,
  recent,
}: {
  label: string;
  total: number;
  recent: number;
}) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--color-rdv-line)",
        background: "var(--color-rdv-paper)",
      }}
    >
      <div
        className="rdv-mono"
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-rdv-muted)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className="rdv-display"
        style={{ fontSize: 22, lineHeight: 1, letterSpacing: "-0.02em" }}
      >
        {fmtNum(total)}
      </div>
      <div style={{ fontSize: 10, color: "var(--color-rdv-muted)", marginTop: 4 }}>
        {fmtNum(recent)} nos 30d
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-rdv-cream)",
        border: "1.5px solid var(--color-rdv-ink)",
        boxShadow: "4px 4px 0 0 var(--color-rdv-ink)",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--color-rdv-line)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </div>
      <div style={{ padding: 16, overflowX: "auto" }}>{children}</div>
    </div>
  );
}

function BarChart({
  label,
  data,
  color,
  max,
  formatter,
}: {
  label: string;
  data: Array<{ x: string; y: number; raw: number }>;
  color: string;
  max: number;
  formatter: (v: number) => string;
}) {
  const total = data.reduce((acc, d) => acc + d.raw, 0);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-rdv-muted)",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>
          Total: {formatter(total)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          height: 80,
          background: "var(--color-rdv-paper)",
          padding: 6,
          border: "1px solid var(--color-rdv-line)",
        }}
      >
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(2, (d.y / max) * 68) : 2;
          return (
            <div
              key={i}
              title={`${d.x}: ${formatter(d.raw)}`}
              style={{
                flex: 1,
                height: h,
                background: color,
                opacity: d.y > 0 ? 1 : 0.15,
                minWidth: 4,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlanBadge({
  plan,
  status,
}: {
  plan: string | null;
  status: string | null;
}) {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    pro: { bg: "rgba(255, 61, 46, 0.12)", fg: "var(--color-rdv-rec)" },
    free: { bg: "transparent", fg: "var(--color-rdv-muted)" },
  };
  const effective = (status === "active" ? plan : "free") ?? "free";
  const c = colorMap[effective] ?? colorMap.free;
  return (
    <span
      className="rdv-mono"
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        padding: "3px 8px",
        background: c.bg,
        color: c.fg,
        border: "1px solid currentColor",
      }}
    >
      {effective}
    </span>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: string | null;
  error?: string | null;
}) {
  const stat = status ?? "—";
  const isOk = stat === "active" || stat === "ok" || stat === "success";
  return (
    <span
      title={error ?? undefined}
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: isOk ? "#1a8a3a" : "var(--color-rdv-rec)",
      }}
    >
      ● {stat}
    </span>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "10px 8px",
        borderBottom: "1.5px solid var(--color-rdv-ink)",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--color-rdv-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  muted?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align ?? "left",
        padding: "10px 8px",
        borderBottom: "1px solid var(--color-rdv-line)",
        fontSize: 12,
        color: muted ? "var(--color-rdv-muted)" : "var(--color-rdv-ink)",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

// ─── Format ────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--color-rdv-paper)",
  color: "var(--color-rdv-ink)",
};

const centeredLoader: React.CSSProperties = {
  minHeight: "60vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};
