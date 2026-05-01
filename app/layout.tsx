import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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
  title: "Radar Viral · v2",
  description:
    "Inteligência diária de tendências cross-platform: Instagram, YouTube, notícias e newsletters. Brief IA com temas em alta.",
  authors: [{ name: "Kaleidos" }],
  creator: "Kaleidos",
  openGraph: {
    title: "Radar Viral · v2",
    description: "Brief IA + temas em alta cruzando IG, YouTube, news e newsletters.",
    type: "website",
    locale: "pt_BR",
    siteName: "Radar Viral",
  },
  twitter: {
    card: "summary_large_image",
    title: "Radar Viral · v2",
    description: "Brief IA + temas em alta. Diário.",
    creator: "@madureira",
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
