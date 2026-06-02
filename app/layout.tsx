import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Toaster } from "sonner";
import { MetaPixel } from "@/components/MetaPixel";
import { GoogleSignupSync } from "@/components/google-signup-sync";
import { ReferralCapture } from "@/components/ReferralCapture";
import ThemeScript from "./theme-script";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Tipografia da marca Kaleidos (padrão herdado do biblioteca-viral):
//   Inter    → corpo/UI (sans)
//   Atelier  → títulos/display (serif da marca, local)
//   Gridlite → accent/destaque pontual (local)
//   Geist Mono → mono (eyebrows, botões brutalistas)
// Vars mantidas (--font-jakarta/--font-instrument) pra não tocar em
// estilos inline espalhados; agora apontam pras fontes Kaleidos.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const display = localFont({
  src: "../public/fonts/Atelier.ttf",
  variable: "--font-instrument",
  display: "swap",
  weight: "400",
});

const gridlite = localFont({
  src: "../public/fonts/Gridlite.otf",
  variable: "--font-gridlite",
  display: "swap",
  weight: "400",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://radar.kaleidos.com.br",
  ),
  title: "Radar Viral — Brief editorial diário, em 2 minutos",
  description:
    "IA cruza notícias, Instagram e YouTube do seu nicho e te entrega 3 narrativas, 5 temas em alta e 3 ideias prontas pra postar. Todo dia 10h.",
  authors: [{ name: "Kaleidos" }],
  creator: "Kaleidos",
  openGraph: {
    title: "Radar Viral — Brief editorial diário, em 2 minutos",
    description:
      "IA cruza notícias, IG e YouTube do seu nicho. Narrativas, temas em alta, ideias pra postar. Todo dia 10h.",
    type: "website",
    locale: "pt_BR",
    siteName: "Radar Viral",
  },
  twitter: {
    card: "summary_large_image",
    title: "Radar Viral — Brief editorial diário",
    description: "3 narrativas + 5 temas + 3 ideias. Cruzando 3 plataformas. Todo dia 10h.",
    creator: "@madureira",
  },
  // Facebook domain verification — pareia com Pixel 1653489742563071 no
  // Madureira BM (704738313932684). Atribui radar.kaleidos.com.br ao BM
  // (asset id 891797797244412). Necessário pra Aggregated Event Measurement.
  other: {
    "facebook-domain-verification": "311lr45ybrvv5ubmx57u6yibpfkkho",
  },
};

export const viewport: Viewport = {
  // Theme-aware: o chrome do navegador mobile (address bar) acompanha o tema.
  // Light = branco Kaleidos #FAFAFA, dark = preto puro #000.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${display.variable} ${gridlite.variable} ${mono.variable}`}
    >
      <head>
        {/* Anti-FOUC: seta data-theme="dark" no <html> antes do paint. */}
        <ThemeScript />
      </head>
      <body
        style={{
          background: "var(--color-rdv-paper)",
          color: "var(--color-rdv-ink)",
        }}
      >
        <MetaPixel pixelId="1653489742563071" />
        <ReferralCapture />
        <GoogleSignupSync />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-rdv-ink)",
              color: "var(--color-rdv-paper)",
              border: "1.5px solid var(--color-rdv-rec)",
              fontFamily: "var(--font-jakarta)",
              fontSize: 13,
            },
          }}
        />
      </body>
      {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
    </html>
  );
}
