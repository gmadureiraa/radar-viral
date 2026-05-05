"use client";

/**
 * / — landing pública. Hero curto, "Entrar/Cadastrar" abre AuthDialog.
 *
 * v1 do Radar Viral roda em paralelo em radar.kaleidos.com.br (Vite/React).
 * Esta v2 vai pra subdomínio próprio (sugestão: radar2.kaleidos.com.br ou
 * Vercel preview até trocar o alias).
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Sparkles,
  Activity,
  Layers,
  Zap,
  Eye,
} from "lucide-react";
import { useNeonSession } from "@/lib/auth-client";
import { AuthDialog } from "@/components/auth-dialog";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Landing />
    </Suspense>
  );
}

function Landing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useNeonSession();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (searchParams.get("login") === "required") {
      setShowAuth(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!session.isPending && session.data?.user) {
      router.replace("/app");
    }
  }, [session.isPending, session.data?.user, router]);

  return (
    <main style={{ minHeight: "100dvh", background: "var(--color-rdv-paper)" }}>
      {/* HEADER */}
      <header
        style={{
          padding: "18px 28px",
          borderBottom: "1.5px solid var(--color-rdv-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <a href="/" style={brandLink}>
          <span style={brandDot} />
          <span className="rdv-display" style={{ fontSize: 24, lineHeight: 1, letterSpacing: "-0.02em" }}>
            Radar <em>Viral</em>
          </span>
        </a>
        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {session.data?.user ? (
            <a href="/app" className="rdv-btn rdv-btn-rec" style={{ padding: "8px 14px", fontSize: 10 }}>
              Abrir app →
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuth(true)}
              className="rdv-btn rdv-btn-ghost"
              style={{ padding: "8px 14px", fontSize: 10 }}
            >
              Entrar
            </button>
          )}
        </nav>
      </header>

      {/* HERO */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "80px 28px 60px",
          textAlign: "center",
        }}
      >
        <div className="rdv-eyebrow" style={{ justifyContent: "center", marginBottom: 18 }}>
          <span className="rdv-rec-dot" /> INTELIGÊNCIA DIÁRIA · CROSS-PLATFORM
        </div>
        <h1
          className="rdv-display"
          style={{
            fontSize: "clamp(36px, 7vw, 88px)",
            lineHeight: 0.98,
            letterSpacing: "-0.02em",
            marginBottom: 24,
          }}
        >
          O que está <em>bombando</em>.<br />
          Por que está. <br />
          E o que <span style={{ color: "var(--color-rdv-rec)" }}>fazer</span>.
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--color-rdv-muted)",
            maxWidth: 600,
            margin: "0 auto 36px",
          }}
        >
          Brief diário gerado por IA cruzando Instagram, YouTube, notícias e
          newsletters. Temas em alta, narrativas dominantes e ideias prontas
          pra postar.
        </p>

        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="rdv-btn rdv-btn-rec"
          style={{ padding: "14px 22px", fontSize: 12 }}
        >
          <Sparkles size={14} />
          Entrar / Criar conta grátis
          <ArrowRight size={14} />
        </button>

        <p
          className="rdv-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-rdv-muted)",
            marginTop: 16,
          }}
        >
          ⚡ Brief diário · 4 fontes cruzadas · Sem cartão
        </p>
      </section>

      {/* STATS */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "30px 28px 60px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 18,
        }}
      >
        <Stat
          icon={<Activity size={20} />}
          title="Brief 10h30"
          desc="IA gera narrativas + temas em alta + ideias prontas todo dia."
        />
        <Stat
          icon={<Layers size={20} />}
          title="4 fontes cruzadas"
          desc="Instagram, YouTube, notícias e newsletters em um só radar."
        />
        <Stat
          icon={<Zap size={20} />}
          title="Salvar / Recriar"
          desc="Bookmark cross-plataforma + bridge pro Sequência Viral e Reels Viral."
        />
        <Stat
          icon={<Eye size={20} />}
          title="Hashtag tracker"
          desc="Termos quentes da semana com cliques pra filtrar grid."
        />
      </section>

      {/* PRO SPOTLIGHT */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "20px 28px 50px",
        }}
      >
        <div
          className="rdv-card"
          style={{
            padding: "36px 32px",
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 28,
            alignItems: "center",
            borderColor: "var(--color-rdv-rec)",
            boxShadow: "12px 12px 0 0 var(--color-rdv-rec)",
            position: "relative",
          }}
        >
          <span
            className="rdv-mono"
            style={{
              position: "absolute",
              top: -12,
              left: 24,
              background: "var(--color-rdv-rec)",
              color: "white",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              padding: "5px 10px",
            }}
          >
            Plano Pro
          </span>
          <div>
            <div className="rdv-eyebrow" style={{ marginBottom: 8 }}>
              <span className="rdv-rec-dot" /> AGENTE IA · TIKTOK · NICHO ESPECÍFICO
            </div>
            <h2
              className="rdv-display"
              style={{
                fontSize: "clamp(26px, 3vw, 38px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                marginBottom: 14,
              }}
            >
              A maioria cria conteúdo no TikTok <em>às cegas</em>.
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--color-rdv-muted)",
                marginBottom: 18,
              }}
            >
              O agente de IA do Pro analisa seu nicho e te dá os ganchos, formatos
              e temas que estão viralizando agora mesmo, com brief diário
              personalizado e bookmarks integrados ao Sequência Viral.
            </p>
            <a
              href="/app/precos#planos"
              className="rdv-btn rdv-btn-rec"
              style={{ padding: "12px 18px", fontSize: 11 }}
            >
              <Sparkles size={12} /> Ver plano Pro
              <ArrowRight size={12} />
            </a>
          </div>
          <div
            style={{
              padding: "20px 22px",
              background: "var(--color-rdv-paper)",
              border: "1.5px solid var(--color-rdv-ink)",
            }}
          >
            <div className="rdv-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14, color: "var(--color-rdv-muted)" }}>
              Plano Pro · R$ 99,90/mês
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {[
                "Radar individual: suas fontes, seu DB",
                "2 nichos simultâneos",
                "15 IG · 8 YouTube · 10 TikTok · 15 RSS · 12 newsletters",
                "TikTok scraping incluído",
                "Briefs IA ilimitados",
                "Agente IA conversacional dedicado por nicho",
              ].map((feat) => (
                <li key={feat} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ color: "var(--color-rdv-rec)", fontWeight: 800 }}>+</span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING TEASER — 2 planos (Free + Pro). Max foi descontinuado pra
          novos users em mai/2026 e suas features migraram pro Pro. */}
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "10px 28px 70px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
        }}
      >
        <div
          className="rdv-card"
          style={{
            padding: "26px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
            FREE · GRÁTIS
          </div>
          <div
            className="rdv-display"
            style={{
              fontSize: 36,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            R$ 0
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-rdv-muted)",
              lineHeight: 1.5,
            }}
          >
            Radar global compartilhado. Brief diário, salvar e bridges pro Sequência Viral e Reels Viral.
          </p>
        </div>
        <div
          className="rdv-card"
          style={{
            padding: "26px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderColor: "var(--color-rdv-rec)",
            boxShadow: "10px 10px 0 0 var(--color-rdv-rec)",
            position: "relative",
          }}
        >
          <span
            className="rdv-mono"
            style={{
              position: "absolute",
              top: -12,
              right: 16,
              background: "var(--color-rdv-rec)",
              color: "white",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              padding: "5px 10px",
            }}
          >
            Recomendado
          </span>
          <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
            PRO · COMPLETO
          </div>
          <div
            className="rdv-display"
            style={{
              fontSize: 36,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginBottom: 4,
              display: "flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            R$ 99,90
            <span style={{ fontSize: 13, color: "var(--color-rdv-muted)" }}>
              /mês
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-rdv-muted)",
              marginBottom: 8,
            }}
          >
            de <s>R$ 149</s>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-rdv-muted)",
              lineHeight: 1.5,
            }}
          >
            Radar individual com cron próprio. 2 nichos · 15 IG · 8 YouTube · 10 TikTok · 15 RSS · 12 newsletters. Briefs IA ilimitados + agente IA conversacional dedicado por nicho.
          </p>
        </div>
      </section>

      {/* CTA FINAL */}
      <section
        style={{
          background: "var(--color-rdv-ink)",
          color: "var(--color-rdv-paper)",
          padding: "60px 28px",
          textAlign: "center",
        }}
      >
        <div className="rdv-eyebrow" style={{ justifyContent: "center", color: "rgba(245,241,232,0.6)" }}>
          <span className="rdv-rec-dot" /> ENTRA NA WAVE
        </div>
        <h2
          className="rdv-display"
          style={{
            fontSize: "clamp(34px, 4vw, 52px)",
            marginTop: 12,
            marginBottom: 24,
            color: "var(--color-rdv-paper)",
          }}
        >
          Tu não <em>perde</em> o que importa hoje.
        </h2>
        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="rdv-btn rdv-btn-rec"
          style={{ padding: "14px 22px", fontSize: 12 }}
        >
          <Sparkles size={14} /> Acessar o radar
          <ArrowRight size={14} />
        </button>
      </section>

      {/* FOOTER — branding consistente com Reels e SV ("by Kaleidos Digital") */}
      <footer
        style={{
          borderTop: "1.5px solid var(--color-rdv-ink)",
          background: "var(--color-rdv-paper)",
          padding: "32px 28px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
            color: "var(--color-rdv-muted)",
          }}
        >
          <div
            className="rdv-mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--color-rdv-ink)",
            }}
          >
            Radar Viral · by Kaleidos Digital
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
            <a
              href="https://kaleidos.com.br"
              target="_blank"
              rel="noreferrer"
              className="rdv-mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-rdv-muted)",
                textDecoration: "none",
              }}
            >
              kaleidos.com.br ↗
            </a>
            <a
              href="https://viral.kaleidos.com.br"
              target="_blank"
              rel="noreferrer"
              className="rdv-mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-rdv-muted)",
                textDecoration: "none",
              }}
            >
              Sequência Viral ↗
            </a>
            <a
              href="https://reels.kaleidos.com.br"
              target="_blank"
              rel="noreferrer"
              className="rdv-mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-rdv-muted)",
                textDecoration: "none",
              }}
            >
              Reels Viral ↗
            </a>
          </nav>
        </div>
      </footer>

      {showAuth && (
        <AuthDialog
          title="Entra no radar"
          subtitle="Brief diário, temas em alta e tudo que viraliza no seu nicho."
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            session.refresh();
          }}
        />
      )}
    </main>
  );
}

const brandLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  textDecoration: "none",
  color: "var(--color-rdv-ink)",
};

const brandDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "var(--color-rdv-rec)",
  boxShadow: "0 0 8px var(--color-rdv-rec)",
};

function Stat({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rdv-card" style={{ padding: "22px 24px" }}>
      <div
        style={{
          width: 40,
          height: 40,
          background: "var(--color-rdv-ink)",
          color: "var(--color-rdv-paper)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <div className="rdv-display" style={{ fontSize: 22, lineHeight: 1, marginBottom: 6 }}>
        {title}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.45, color: "var(--color-rdv-muted)" }}>
        {desc}
      </p>
    </div>
  );
}
