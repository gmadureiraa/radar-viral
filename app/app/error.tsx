/**
 * Error boundary do shell `/app` — render dentro do layout (sidebar + main).
 *
 * Usado quando uma page do app crasha. O RootLayout + AppLayout continuam
 * montados; só o <main> children que vai pra esse fallback.
 *
 * Referência: https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: Sentry/PostHog
    console.error("[app/error]", error.message, "digest:", error.digest);
  }, [error]);

  return (
    <div
      style={{
        padding: "32px 24px",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <div
        className="rdv-card"
        style={{
          padding: "28px 26px",
        }}
      >
        <div
          className="rdv-eyebrow"
          style={{
            color: "var(--color-rdv-rec)",
            marginBottom: 12,
          }}
        >
          <span className="rdv-rec-dot" /> ERRO NA TELA
        </div>
        <h1
          className="rdv-display"
          style={{
            fontSize: 32,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 0 10px",
          }}
        >
          Algo travou aqui.
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "rgba(10,9,8,0.72)",
            margin: "0 0 18px",
          }}
        >
          O resto do app continua funcionando — clica abaixo pra tentar
          carregar essa tela de novo. Se persistir, troca de aba e volta.
        </p>
        {error.digest && (
          <div
            className="rdv-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "rgba(10,9,8,0.5)",
              marginBottom: 18,
            }}
          >
            ref: {error.digest}
          </div>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="rdv-btn rdv-btn-rec"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <RotateCw size={14} strokeWidth={2.2} /> Tentar de novo
        </button>
      </div>
    </div>
  );
}
