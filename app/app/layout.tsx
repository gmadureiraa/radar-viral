"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Instagram,
  Youtube,
  Newspaper,
  TrendingUp,
  BookmarkCheck,
  Settings as SettingsIcon,
  Shield,
  LogOut,
  Menu,
  X,
  CreditCard,
  Gift,
  AtSign,
  Music2,
} from "lucide-react";
import {
  useNeonSession,
  isAuthConfigured,
  signOutAndReset,
} from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin-emails";
import { NicheProvider, useActiveNiche } from "@/lib/niche-context";
import ThemeToggle from "@/components/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

/**
 * Sidebar nav split em 2 grupos (igual SV):
 *   - PRIMARY (topo): features principais — Dashboard, IG, YT, News, Newsletters, Salvos
 *   - SECONDARY (rodapé, antes do user card): Indique e ganhe, Ajustes, Planos
 */
/**
 * Newsletters propositalmente fora do nav até o pipeline Gmail OAuth
 * estar pronto. A tabela tem só subscription confirmations, não conteúdo
 * real — feature ficaria parecendo quebrada. Página /app/newsletters
 * continua acessível via URL direta (não 404), só sai do menu.
 */
const PRIMARY_NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/instagram", label: "Instagram", icon: Instagram },
  { href: "/app/threads", label: "Threads", icon: AtSign, badge: "NEW" },
  { href: "/app/tiktok", label: "TikTok", icon: Music2, badge: "NEW" },
  { href: "/app/youtube", label: "YouTube", icon: Youtube },
  { href: "/app/news", label: "Notícias", icon: Newspaper },
  { href: "/app/trends", label: "Tendências", icon: TrendingUp, badge: "NEW" },
  { href: "/app/saved", label: "Salvos", icon: BookmarkCheck },
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/app/settings/referrals", label: "Indique e ganhe", icon: Gift },
  { href: "/app/settings", label: "Ajustes", icon: SettingsIcon },
  { href: "/app/precos", label: "Planos", icon: CreditCard },
];

const ADMIN_NAV_ITEM: NavItem = {
  href: "/app/admin",
  label: "Admin",
  icon: Shield,
  badge: "DEV",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NicheProvider>
      <AppShell>{children}</AppShell>
    </NicheProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useNeonSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthConfigured()) return;
    if (session.isPending) return;
    if (!session.data?.user) {
      router.replace("/?login=required");
      return;
    }
    // Force onboarding na primeira visita. Flag local persistente.
    // Páginas exceto /app/onboarding redirecionam pra lá se flag não tá
    // setada. Niche também é proxy: quem já tem niche setado é veterano.
    if (typeof window !== "undefined" && pathname !== "/app/onboarding") {
      try {
        const done = localStorage.getItem("rdv_onboarding_done");
        const hasNiche = localStorage.getItem("rdv_active_niche");
        if (!done && !hasNiche) {
          router.replace("/app/onboarding");
        }
      } catch {
        /* localStorage bloqueado, ignora */
      }
    }
  }, [session.isPending, session.data?.user, pathname, router]);

  if (session.isPending) {
    return (
      <div
        role="status"
        aria-label="Carregando"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-rdv-paper)",
        }}
      >
        <div className="rdv-eyebrow">
          <span className="rdv-rec-dot" /> CARREGANDO…
        </div>
      </div>
    );
  }

  if (!session.data?.user) return null;

  // Onboarding é tela cheia sem sidebar — primeira impressão limpa.
  if (pathname === "/app/onboarding") {
    return <>{children}</>;
  }

  const isAdmin = isAdminEmail(session.data.user.email);
  // Admin entra no PRIMARY (debug). SECONDARY (Indique/Ajustes/Planos) sempre
  // no rodapé do sidebar — separado visualmente pra ficar igual ao SV.
  const primaryItems = isAdmin ? [...PRIMARY_NAV, ADMIN_NAV_ITEM] : PRIMARY_NAV;
  const secondaryItems = SECONDARY_NAV;
  const closeDrawer = () => setMobileOpen(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-rdv-paper)" }}>
      {/* Sidebar desktop */}
      <aside
        className="rdv-sidebar-desktop"
        style={{
          width: 232,
          flexShrink: 0,
          background: "var(--color-rdv-ink)",
          color: "var(--color-rdv-paper)",
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SidebarContent
          pathname={pathname}
          primaryItems={primaryItems}
          secondaryItems={secondaryItems}
          userEmail={session.data.user.email}
          userName={session.data.user.name}
          onNavigate={closeDrawer}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          onClick={closeDrawer}
          className="rdv-sidebar-mobile-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(10,9,8,0.55)", zIndex: 60 }}
        />
      )}
      <aside
        className="rdv-sidebar-mobile"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: 232,
          background: "var(--color-rdv-ink)",
          color: "var(--color-rdv-paper)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s ease",
          zIndex: 70,
        }}
      >
        <SidebarContent
          pathname={pathname}
          primaryItems={primaryItems}
          secondaryItems={secondaryItems}
          userEmail={session.data.user.email}
          userName={session.data.user.name}
          onNavigate={closeDrawer}
          showCloseButton
          onClose={closeDrawer}
        />
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <header
          className="rdv-app-mobile-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--color-rdv-paper)",
            borderBottom: "1.5px solid var(--color-rdv-ink)",
          }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            style={{
              border: "1.5px solid var(--color-rdv-ink)",
              padding: 8,
              cursor: "pointer",
              background: "transparent",
            }}
          >
            <Menu size={16} />
          </button>
          <div className="rdv-eyebrow">
            <span className="rdv-rec-dot" /> RADAR VIRAL
          </div>
          <div style={{ width: 32 }} />
        </header>

        <div>{children}</div>
      </main>

      <style jsx global>{`
        @media (max-width: 1023px) {
          .rdv-sidebar-desktop {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .rdv-sidebar-mobile,
          .rdv-sidebar-mobile-backdrop,
          .rdv-app-mobile-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Sidebar content (desktop + drawer) ─────────────────────────────

function SidebarContent({
  pathname,
  primaryItems,
  secondaryItems,
  userEmail,
  userName,
  onNavigate,
  showCloseButton,
  onClose,
}: {
  pathname: string;
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  userEmail: string;
  userName: string | null | undefined;
  onNavigate: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}) {
  const handleSignOut = async () => {
    // signOutAndReset: aguarda /sign-out remoto, limpa cliente cacheado,
    // localStorage (better-auth.*, rdv_*) e sessionStorage, depois faz
    // window.location.replace("/?signed_out=1"). A flag suprime o
    // auto-redirect da landing por ~5s, evitando que o user caia de volta
    // em /app caso o cookie cross-origin demore pra invalidar.
    await signOutAndReset();
  };

  // Helper que renderiza um link de nav. Reusado pelo PRIMARY e SECONDARY
  // pra manter consistência visual sem duplicar JSX.
  function renderNavLink({ href, label, icon: Icon, badge }: NavItem) {
    // /app/settings precisa ser exato pra não engolir /app/settings/referrals.
    const active =
      href === "/app"
        ? pathname === "/app"
        : href === "/app/settings"
          ? pathname === "/app/settings"
          : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 10px",
          background: active ? "var(--color-rdv-rec)" : "transparent",
          color: active ? "var(--color-rdv-cream)" : "color-mix(in srgb, var(--color-rdv-paper) 72%, transparent)",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: active ? "2px 2px 0 0 rgba(0,0,0,0.3)" : "none",
          transition: "background 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = "color-mix(in srgb, var(--color-rdv-paper) 8%, transparent)";
            e.currentTarget.style.color = "var(--color-rdv-paper)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "color-mix(in srgb, var(--color-rdv-paper) 72%, transparent)";
          }
        }}
      >
        <Icon size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
        {badge && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "1px 6px",
              background: active ? "rgba(0,0,0,0.18)" : "var(--color-rdv-rec)",
              color: "var(--color-rdv-cream)",
            }}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "22px 18px 20px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 18,
          marginBottom: 14,
          borderBottom: "1px solid color-mix(in srgb, var(--color-rdv-paper) 12%, transparent)",
        }}
      >
        <Link
          href="/app"
          onClick={onNavigate}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "var(--color-rdv-paper)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-rdv-rec)",
              boxShadow: "0 0 8px var(--color-rdv-rec)",
            }}
          />
          <span className="rdv-display" style={{ fontSize: 22, lineHeight: 1, letterSpacing: "-0.02em" }}>
            Radar <em>Viral</em>
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ThemeToggle />
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar menu"
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "color-mix(in srgb, var(--color-rdv-paper) 70%, transparent)" }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Niche switcher */}
      <NicheSwitcher />

      <div
        style={{
          padding: "8px 4px 6px",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-rdv-paper) 55%, transparent)",
          fontWeight: 700,
          marginTop: 14,
        }}
      >
        Workspace
      </div>

      {/* Primary nav (workspace) */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {primaryItems.map(renderNavLink)}
      </nav>

      {/* Spacer flexível empurra SECONDARY pra base do sidebar */}
      <div style={{ flex: 1, minHeight: 24 }} />

      {/* Secondary nav (rodapé): Indique e ganhe, Ajustes, Planos. Section
          label + divider sutil pra ficar visualmente separado do PRIMARY. */}
      <div
        style={{
          padding: "8px 4px 6px",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-rdv-paper) 55%, transparent)",
          fontWeight: 700,
          borderTop: "1px solid color-mix(in srgb, var(--color-rdv-paper) 12%, transparent)",
          marginTop: 12,
          paddingTop: 14,
        }}
      >
        Conta
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
        {secondaryItems.map(renderNavLink)}
      </nav>

      <div
        style={{
          padding: "12px 12px",
          border: "1px solid color-mix(in srgb, var(--color-rdv-paper) 18%, transparent)",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 8.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "color-mix(in srgb, var(--color-rdv-paper) 55%, transparent)",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Logado
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-rdv-paper)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={userEmail}
        >
          {userName ?? userEmail.split("@")[0]}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "color-mix(in srgb, var(--color-rdv-paper) 60%, transparent)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {userEmail}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "9px 12px",
          background: "transparent",
          color: "color-mix(in srgb, var(--color-rdv-paper) 60%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-rdv-paper) 14%, transparent)",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <LogOut size={11} /> Sair
      </button>
    </div>
  );
}

// ─── NicheSwitcher (dropdown na sidebar) ────────────────────────────

function NicheSwitcher() {
  const { active, setActive, niches } = useActiveNiche();
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
    <div ref={ref} style={{ position: "relative", marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Trocar nicho do radar"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "color-mix(in srgb, var(--color-rdv-paper) 6%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-rdv-paper) 18%, transparent)",
          color: "var(--color-rdv-paper)",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: active.color,
            boxShadow: `0 0 6px ${active.color}`,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 700 }}>
          {active.emoji} {active.label}
        </span>
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            color: "color-mix(in srgb, var(--color-rdv-paper) 60%, transparent)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Nichos disponíveis"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--color-rdv-coal)",
            border: "1px solid color-mix(in srgb, var(--color-rdv-paper) 18%, transparent)",
            zIndex: 10,
            boxShadow: "4px 4px 0 0 rgba(255, 61, 46, 0.4)",
          }}
        >
          {niches.map((n) => (
            <button
              key={n.id}
              type="button"
              role="option"
              aria-selected={n.id === active.id}
              onClick={() => {
                setActive(n.id);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: n.id === active.id ? "rgba(255, 61, 46, 0.15)" : "transparent",
                border: "none",
                color: "var(--color-rdv-paper)",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 11,
                fontWeight: n.id === active.id ? 700 : 500,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: n.color,
                  flexShrink: 0,
                }}
              />
              <span>
                {n.emoji} {n.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
