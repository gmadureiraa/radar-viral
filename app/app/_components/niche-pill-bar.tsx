"use client";

/**
 * Barra de pills pra trocar de nicho — visível no topo do dashboard.
 *
 * Vs sidebar dropdown: aqui é always-visible, 1-clique entre nichos.
 * Pra dashboard onde "qual brief você tá lendo" é a 1a info.
 *
 * Disparar setActive() já dispara `niche-changed` event, então
 * componentes não-React (cards) reagem sozinhos.
 */

import { useActiveNiche } from "@/lib/niche-context";

export function NichePillBar() {
  const { active, setActive, niches } = useActiveNiche();
  return (
    <div
      role="tablist"
      aria-label="Escolher nicho do radar"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 3,
        background: "var(--color-rdv-paper)",
        border: "1.5px solid var(--color-rdv-ink)",
        boxShadow: "3px 3px 0 0 var(--color-rdv-ink)",
        marginBottom: 18,
      }}
    >
      {niches.map((n) => {
        const isActive = n.id === active.id;
        return (
          <button
            key={n.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActive(n.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              background: isActive ? "var(--color-rdv-ink)" : "transparent",
              color: isActive ? "white" : "var(--color-rdv-ink)",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              transition: "background 0.12s, color 0.12s",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: n.color,
                boxShadow: isActive ? `0 0 6px ${n.color}` : "none",
                flexShrink: 0,
              }}
            />
            {n.label}
          </button>
        );
      })}
    </div>
  );
}
