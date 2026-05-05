"use client";

/**
 * /app/onboarding — Welcome flow obrigatório no primeiro login.
 *
 * 3 etapas:
 *  1. Escolha do nicho (radar é niche-bound, então é a 1a decisão)
 *  2. Explica brief diário (formato + horário)
 *  3. Promessa de retorno: redireciona pro dashboard com niche setado
 *
 * Persistência: localStorage `rdv_onboarding_done = "true"` + setActive(niche).
 *
 * Trigger: layout `/app/layout.tsx` checa flag e redireciona pra cá.
 * User existente que volta após o flag virar true não cai aqui.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Newspaper,
  Instagram,
  Youtube,
  Mail,
  Sparkles,
  Activity,
  Flame,
} from "lucide-react";
import { NICHES } from "@/lib/niches";
import { useActiveNiche } from "@/lib/niche-context";
import { useNeonSession } from "@/lib/auth-client";

const ONBOARDING_FLAG = "rdv_onboarding_done";

type Step = 0 | 1 | 2;

export default function OnboardingPage() {
  const router = useRouter();
  const session = useNeonSession();
  const { setActive } = useActiveNiche();
  const [step, setStep] = useState<Step>(0);
  const [pickedNiche, setPickedNiche] = useState<string | null>(null);

  const userName =
    session.data?.user?.name?.split(" ")[0] ??
    session.data?.user?.email?.split("@")[0] ??
    "";

  function pickNiche(id: string) {
    setPickedNiche(id);
    setActive(id);
    setStep(1);
  }

  function finish() {
    try {
      localStorage.setItem(ONBOARDING_FLAG, "true");
    } catch {
      /* localStorage bloqueado, segue */
    }
    router.push("/app");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-rdv-paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "var(--color-rdv-cream)",
          border: "1.5px solid var(--color-rdv-ink)",
          boxShadow: "8px 8px 0 0 var(--color-rdv-ink)",
          padding: "40px 36px",
        }}
      >
        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: i === step ? 28 : 10,
                height: 4,
                background:
                  i <= step ? "var(--color-rdv-rec)" : "var(--color-rdv-line)",
                transition: "width 0.18s ease",
              }}
            />
          ))}
        </div>

        {step === 0 && <StepNiche userName={userName} onPick={pickNiche} />}
        {step === 1 && pickedNiche && (
          <StepBriefIntro
            nicheId={pickedNiche}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && pickedNiche && (
          <StepDone
            nicheId={pickedNiche}
            userName={userName}
            onFinish={finish}
          />
        )}
      </div>
    </main>
  );
}

// ─── Step 0: escolha de nicho ──────────────────────────────────────

function StepNiche({
  userName,
  onPick,
}: {
  userName: string;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <div className="rdv-eyebrow" style={{ marginBottom: 8 }}>
        <span className="rdv-rec-dot" /> BEM-VINDO
      </div>
      <h1
        className="rdv-display"
        style={{
          fontSize: "clamp(28px, 4vw, 40px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        Oi{userName ? <>, <em>{userName}</em></> : <em></em>}.{" "}
        <span style={{ display: "block", marginTop: 4 }}>
          Sobre <em>o quê</em> você cria conteúdo?
        </span>
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-rdv-muted)",
          marginBottom: 28,
          lineHeight: 1.5,
        }}
      >
        Pra montar seu radar, preciso saber qual editoria você acompanha.
        Pode trocar depois nas configurações.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {NICHES.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onPick(n.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 20px",
              background: "white",
              border: "1.5px solid var(--color-rdv-ink)",
              cursor: "pointer",
              textAlign: "left",
              transition: "transform 0.1s, box-shadow 0.1s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(-2px, -2px)";
              e.currentTarget.style.boxShadow =
                "4px 4px 0 0 var(--color-rdv-rec)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(0, 0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                background: n.color,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {n.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="rdv-display"
                style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 4 }}
              >
                {n.label}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--color-rdv-muted)",
                  lineHeight: 1.4,
                }}
              >
                {n.description}
              </div>
            </div>
            <ArrowRight size={20} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Step 1: brief intro ────────────────────────────────────────────

function StepBriefIntro({
  nicheId,
  onNext,
  onBack,
}: {
  nicheId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const niche = NICHES.find((n) => n.id === nicheId);
  return (
    <>
      <div className="rdv-eyebrow" style={{ marginBottom: 8 }}>
        <span className="rdv-rec-dot" /> COMO FUNCIONA
      </div>
      <h1
        className="rdv-display"
        style={{
          fontSize: "clamp(26px, 3.6vw, 36px)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          marginBottom: 18,
        }}
      >
        Todo dia <em>10h</em>, um brief de{" "}
        <em>{niche?.label ?? "seu nicho"}</em>.
      </h1>

      <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
        <FeatureRow
          icon={<Newspaper size={18} />}
          title="3 plataformas, 1 brief"
          desc="A IA lê notícias, top posts do Instagram e novos vídeos do YouTube das fontes do nicho. Cruza tudo num brief de leitura rápida."
        />
        <FeatureRow
          icon={<Activity size={18} />}
          title="Narrativas, não headlines"
          desc="Em vez de 200 manchetes, você recebe 3 narrativas dominantes + 5 temas em alta. Sabe o que IMPORTA hoje em 2 minutos."
        />
        <FeatureRow
          icon={<Flame size={18} />}
          title="Ontem virou hoje"
          desc="Loop closure: o que apareceu ontem subiu, esfriou ou explodiu? Brief diário sem virar mais uma newsletter ignorada."
        />
        <FeatureRow
          icon={<Sparkles size={18} />}
          title="Pronto pra postar"
          desc="Cada tema vira hook + ângulo + carrossel. Botão joga você direto na produção (Sequência Viral) ou Reels Viral."
        />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={onBack}
          className="rdv-btn rdv-btn-ghost"
          style={{ padding: "10px 18px", fontSize: 11 }}
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rdv-btn rdv-btn-rec"
          style={{ padding: "10px 18px", fontSize: 11 }}
        >
          Continuar <ArrowRight size={12} />
        </button>
      </div>
    </>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          background: "var(--color-rdv-rec)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, lineHeight: 1.2 }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--color-rdv-muted)",
            lineHeight: 1.45,
          }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: done ───────────────────────────────────────────────────

function StepDone({
  nicheId,
  userName,
  onFinish,
}: {
  nicheId: string;
  userName: string;
  onFinish: () => void;
}) {
  const niche = NICHES.find((n) => n.id === nicheId);
  return (
    <>
      <div
        style={{
          width: 64,
          height: 64,
          background: "var(--color-rdv-rec)",
          color: "white",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <Check size={30} strokeWidth={2.5} />
      </div>
      <h1
        className="rdv-display"
        style={{
          fontSize: "clamp(26px, 3.6vw, 36px)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Tá <em>tudo pronto</em>{userName ? `, ${userName}` : ""}.
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-rdv-muted)",
          lineHeight: 1.5,
          textAlign: "center",
          marginBottom: 28,
          maxWidth: 480,
          margin: "0 auto 28px",
        }}
      >
        Seu radar de <strong>{niche?.label}</strong> já tá ativo. O brief de
        hoje já tá esperando — e amanhã 10h da manhã o próximo cai.
      </p>

      <div
        style={{
          background: "var(--color-rdv-paper)",
          border: "1px dashed var(--color-rdv-line)",
          padding: "14px 16px",
          marginBottom: 24,
          fontSize: 12,
          color: "var(--color-rdv-muted)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--color-rdv-ink)" }}>Dica:</strong>{" "}
        Adicione o domínio ao bookmark — o hábito de ler o brief de manhã
        é o que faz a diferença entre criar conteúdo ralo vs antecipar a
        próxima onda.
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={onFinish}
          className="rdv-btn rdv-btn-rec"
          style={{ padding: "12px 28px", fontSize: 12 }}
        >
          Ver meu primeiro brief <ArrowRight size={13} />
        </button>
      </div>
    </>
  );
}
