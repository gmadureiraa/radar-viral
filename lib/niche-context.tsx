"use client";

/**
 * Niche context — global state do nicho ativo (compartilhado entre páginas).
 *
 * Persiste em localStorage. Dispara custom event 'niche-changed' pra páginas
 * sem hook React reagirem (ex: re-fetch de dados).
 */

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_NICHE, NICHES, getNiche, type Niche } from "./niches";

const STORAGE_KEY = "rdv_active_niche";

interface NicheContextValue {
  active: Niche;
  setActive: (id: string) => void;
  niches: Niche[];
}

const NicheContext = createContext<NicheContextValue | null>(null);

export function NicheProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string>(DEFAULT_NICHE.id);

  // Hidrata do localStorage no mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && getNiche(stored)) {
        setActiveId(stored);
      }
    } catch {
      /* localStorage bloqueado */
    }
  }, []);

  const setActive = (id: string) => {
    if (!getNiche(id)) return;
    setActiveId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* noop */
    }
    // Dispara evento global pra componentes não-React refazerem fetch
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("niche-changed", { detail: { niche: id } }));
    }
  };

  const active = getNiche(activeId) ?? DEFAULT_NICHE;

  return (
    <NicheContext.Provider value={{ active, setActive, niches: NICHES }}>
      {children}
    </NicheContext.Provider>
  );
}

export function useActiveNiche(): NicheContextValue {
  const ctx = useContext(NicheContext);
  if (!ctx) {
    // Fallback silencioso quando provider ausente — útil em SSR ou tests
    return {
      active: DEFAULT_NICHE,
      setActive: () => {},
      niches: NICHES,
    };
  }
  return ctx;
}
