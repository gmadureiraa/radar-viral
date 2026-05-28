import { ImageResponse } from "next/og";

/**
 * OG image gerada em build (estática) pro Radar Viral.
 *
 * Antes deste arquivo não havia imagem de preview — todo share no
 * WhatsApp/Twitter/LinkedIn saía sem card visual. Gerada via ImageResponse
 * (Satori) com a paleta da marca Kaleidos: preto + accent verde #7CF067 +
 * branco. Sem fetch de fontes externas (usa system sans) pra não falhar
 * o build offline. Reusada pelo Twitter card via twitter-image.tsx.
 */

export const runtime = "nodejs";
export const alt = "Radar Viral — Brief editorial diário, em 2 minutos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Eyebrow com REC dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#7CF067",
            }}
          />
          <div
            style={{
              fontSize: 24,
              letterSpacing: 8,
              color: "#B0AFAC",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            RADAR VIRAL · KALEIDOS
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.05,
              color: "#FAFAFA",
              fontWeight: 800,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            Brief editorial diário, em 2 minutos.
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.35,
              color: "#B0AFAC",
              maxWidth: 900,
            }}
          >
            IA cruza notícias, Instagram e YouTube do seu nicho. 3 narrativas,
            5 temas em alta, 3 ideias prontas pra postar. Todo dia 10h.
          </div>
        </div>

        {/* Footer bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              background: "#7CF067",
              color: "#000000",
              fontSize: 26,
              fontWeight: 800,
              padding: "10px 24px",
              letterSpacing: 1,
            }}
          >
            radar.kaleidos.com.br
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
