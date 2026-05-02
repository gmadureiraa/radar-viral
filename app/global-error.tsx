/**
 * Global error boundary — pega erros que escapam de qualquer layout/page.
 *
 * IMPORTANTE: como esse arquivo substitui o RootLayout em estado de erro,
 * precisa renderizar <html> e <body> próprios. Mantemos as fontes via
 * className do system (carregadas pelo browser via Next).
 *
 * Referência: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */

"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: trocar por Sentry/PostHog quando integrar
    console.error("[global-error]", error.message, "digest:", error.digest);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          background: "#F5F1E8",
          color: "#0A0908",
          minHeight: "100vh",
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#ECECE6",
            border: "1.5px solid #0A0908",
            boxShadow: "4px 4px 0 0 #0A0908",
            padding: "32px 28px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              color: "#FF3D2E",
              marginBottom: 12,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#FF3D2E",
                boxShadow: "0 0 8px #FF3D2E",
              }}
            />
            ERRO CRÍTICO
          </div>
          <h1
            style={{
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: "0 0 12px",
              fontWeight: 700,
            }}
          >
            Algo deu errado.
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: "rgba(10,9,8,0.72)",
              margin: "0 0 20px",
            }}
          >
            O Radar travou enquanto carregava essa tela. Tenta recarregar — se
            continuar, manda um print pro time pelo email do suporte.
          </p>
          {error.digest && (
            <div
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "rgba(10,9,8,0.5)",
                marginBottom: 16,
              }}
            >
              ref: {error.digest}
            </div>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "#FF3D2E",
              color: "white",
              border: "1.5px solid #0A0908",
              boxShadow: "3px 3px 0 0 #0A0908",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
