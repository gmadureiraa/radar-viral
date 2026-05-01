"use client";

import { Construction, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ComingSoonProps {
  title: string;
  description: string;
  v1Path?: string;
}

export function ComingSoon({ title, description, v1Path }: ComingSoonProps) {
  return (
    <main style={{ padding: "32px 28px 80px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="rdv-eyebrow" style={{ marginBottom: 6 }}>
        <span className="rdv-rec-dot" /> EM CONSTRUÇÃO · v2
      </div>
      <h1
        className="rdv-display"
        style={{
          fontSize: "clamp(32px, 4vw, 48px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: 14, color: "var(--color-rdv-muted)", marginBottom: 32, maxWidth: 640 }}>
        {description}
      </p>

      <div
        className="rdv-card"
        style={{
          padding: "32px 28px",
          maxWidth: 600,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            background: "var(--color-rdv-rec)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Construction size={24} />
        </div>
        <div className="rdv-display" style={{ fontSize: 22, lineHeight: 1.1 }}>
          Migrando da <em>v1</em> com a nova vibe
        </div>
        <p style={{ fontSize: 13, color: "var(--color-rdv-muted)", lineHeight: 1.5, maxWidth: 440 }}>
          Esse módulo já existe na v1 e está sendo portado pra esta versão
          com sidebar e design unificado. Enquanto isso, abre na v1 sem perder
          dados.
        </p>
        {v1Path && (
          <Link
            href={`https://radar.kaleidos.com.br${v1Path}`}
            target="_blank"
            rel="noreferrer"
            className="rdv-btn rdv-btn-rec"
            style={{ padding: "11px 18px", fontSize: 11, marginTop: 4 }}
          >
            <ExternalLink size={12} />
            Abrir na v1
          </Link>
        )}
      </div>
    </main>
  );
}
