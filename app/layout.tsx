import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { MetaPixel } from "@/components/MetaPixel";
import { GoogleSignupSync } from "@/components/google-signup-sync";
import { ReferralCapture } from "@/components/ReferralCapture";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
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
  title: "Radar Viral — Inteligência diária cross-platform",
  description:
    "Inteligência diária de tendências cross-platform: Instagram, YouTube, notícias e newsletters. Brief IA com temas em alta.",
  authors: [{ name: "Kaleidos" }],
  creator: "Kaleidos",
  openGraph: {
    title: "Radar Viral — Inteligência diária cross-platform",
    description: "Brief IA + temas em alta cruzando IG, YouTube, news e newsletters.",
    type: "website",
    locale: "pt_BR",
    siteName: "Radar Viral",
  },
  twitter: {
    card: "summary_large_image",
    title: "Radar Viral — Inteligência diária cross-platform",
    description: "Brief IA + temas em alta. Diário.",
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
  themeColor: "#F5F1E8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
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
    </html>
  );
}
