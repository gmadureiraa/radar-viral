"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "rdv-theme";

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

function applyTheme(next: Theme) {
  if (next === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage indisponível — segue em memória pela sessão.
  }
}

/**
 * Toggle de tema (light/dark) com revelação circular via View Transitions.
 *
 * - Lê o tema atual de `document.documentElement` (setado pelo ThemeScript
 *   inline antes do paint, evita FOUC).
 * - Click alterna light/dark, salva em localStorage 'rdv-theme' e atualiza
 *   o atributo data-theme no <html>.
 * - Placeholder invisível antes da montagem evita layout shift / SSR mismatch.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ??
      "light";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const btn = buttonRef.current;
    const doc = document as ViewTransitionDoc;

    if (!btn || typeof doc.startViewTransition !== "function") {
      setTheme(next);
      applyTheme(next);
      return;
    }

    const rect = btn.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${((rect.left + rect.width / 2) / window.innerWidth) * 100}%`);
    root.style.setProperty("--vt-y", `${((rect.top + rect.height / 2) / window.innerHeight) * 100}%`);
    root.classList.add("vt-theme-toggling");

    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        setTheme(next);
        applyTheme(next);
      });
    });
    transition.finished.finally(() => root.classList.remove("vt-theme-toggling"));
  }

  if (!mounted) {
    return <div aria-hidden="true" className="h-9 w-9 shrink-0" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label="Alternar tema"
      title={isDark ? "Modo claro" : "Modo escuro"}
      className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full border border-[var(--color-rdv-line)] hover:border-[var(--color-rdv-rec)] transition-colors"
      style={{
        background: "rgba(245,241,232,0.06)",
        color: "var(--color-rdv-paper)",
      }}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
