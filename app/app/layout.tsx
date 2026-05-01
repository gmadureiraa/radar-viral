"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Instagram,
  Youtube,
  Newspaper,
  Mail,
  BookmarkCheck,
  Settings as SettingsIcon,
  Shield,
  LogOut,
  Menu,
  X,
  CreditCard,
} from "lucide-react";
import {
  useNeonSession,
  getAuthClient,
  isAuthConfigured,
} from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin-emails";
import { NicheProvider, useActiveNiche } from "@/lib/niche-context";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/instagram", label: "Instagram", icon: Instagram },
  { href: "/app/youtube", label: "YouTube", icon: Youtube },
  { href: "/app/news", label: "Notícias", icon: Newspaper },
  { href: "/app/newsletters", label: "Newsletters", icon: Mail },
  { href: "/app/saved", label: "Salvos", icon: BookmarkCheck },
  { href: "/app/precos", label: "Planos", icon: CreditCard },
  { href: "/app/settings", label: "Configurações", icon: SettingsIcon },
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
    }
  }, [session.isPending, session.data?.user, router]);

  if (session.isPending) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-rdv-paper)",
        }}
      >
        <div className="rdv-mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--color-rdv-muted)" }}>
          CARREGANDO…
        </div>
      </div>
    );
  }

  if (!session.data?.user) return null;

  const isAdmin = isAdminEmail(session.data.user.email);
  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
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
          navItems={navItems}
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
          navItems={navItems}
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
  navItems,
  userEmail,
  userName,
  onNavigate,
  showCloseButton,
  onClose,
}: {
  pathname: string;
  navItems: NavItem[];
  userEmail: string;
  userName: string | null | undefined;
  onNavigate: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}) {
  const handleSignOut = async () => {
    if (!isAuthConfigured()) return;
    try {
      const client = await getAuthClient();
      await client.signOut();
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

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
          borderBottom: "1px solid rgba(245,241,232,0.12)",
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
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(245,241,232,0.7)" }}
          >
            <X size={18} />
          </button>
        )}
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
          color: "rgba(245,241,232,0.4)",
          fontWeight: 700,
          marginTop: 14,
        }}
      >
        Workspace
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active =
            href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                background: active ? "var(--color-rdv-rec)" : "transparent",
                color: active ? "white" : "rgba(245,241,232,0.72)",
                fontFamily: "var(--font-geist-mono)",
                fontSize: 10.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: active ? "2px 2px 0 0 rgba(0,0,0,0.3)" : "none",
                transition: "background 0.12s, color 0.12s",
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
                    color: "white",
                  }}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1, minHeight: 24 }} />

      <div
        style={{
          padding: "12px 12px",
          border: "1px solid rgba(245,241,232,0.18)",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 8.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(245,241,232,0.4)",
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
            color: "rgba(245,241,232,0.5)",
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
          color: "rgba(245,241,232,0.5)",
          border: "1px solid rgba(245,241,232,0.14)",
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
  return (
    <div style={{ position: "relative", marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "rgba(245,241,232,0.05)",
          border: "1px solid rgba(245,241,232,0.18)",
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
            color: "rgba(245,241,232,0.5)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--color-rdv-coal)",
            border: "1px solid rgba(245,241,232,0.18)",
            zIndex: 10,
            boxShadow: "4px 4px 0 0 rgba(255, 61, 46, 0.4)",
          }}
        >
          {niches.map((n) => (
            <button
              key={n.id}
              type="button"
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
