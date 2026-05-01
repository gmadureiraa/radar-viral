"use client";

/**
 * SourceActionsMenu — dropdown de 3 pontinhos com ações pra uma fonte.
 *
 * Ações:
 *  - Pausar / Ativar (toggle active)
 *  - Editar handle/label (modal inline)
 *  - Excluir (com confirm)
 *
 * Source state vem do parent; o componente só dispara callbacks.
 */

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pause, Play, Edit3, Trash2 } from "lucide-react";

interface Props {
  active: boolean;
  onTogglePause: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SourceActionsMenu({
  active,
  onTogglePause,
  onEdit,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Ações"
        style={{
          width: 28,
          height: 28,
          background: open ? "var(--color-rdv-paper)" : "transparent",
          border: "1px solid var(--color-rdv-line)",
          color: "var(--color-rdv-ink)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "var(--color-rdv-cream)",
            border: "1.5px solid var(--color-rdv-ink)",
            boxShadow: "4px 4px 0 0 var(--color-rdv-ink)",
            minWidth: 180,
            zIndex: 30,
            padding: 4,
          }}
        >
          <MenuItem
            icon={active ? <Pause size={12} /> : <Play size={12} />}
            label={active ? "Pausar" : "Ativar"}
            onClick={() => {
              setOpen(false);
              onTogglePause();
            }}
          />
          <MenuItem
            icon={<Edit3 size={12} />}
            label="Editar"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          />
          <MenuItem
            icon={<Trash2 size={12} />}
            label="Excluir"
            danger
            onClick={() => {
              setOpen(false);
              if (
                window.confirm(
                  "Excluir essa fonte? Essa ação não pode ser desfeita.",
                )
              ) {
                onDelete();
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: "8px 10px",
        background: "transparent",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: danger ? "var(--color-rdv-rec)" : "var(--color-rdv-ink)",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-rdv-paper)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      {label}
    </button>
  );
}
