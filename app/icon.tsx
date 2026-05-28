import { ImageResponse } from "next/og";

/**
 * Favicon gerado (32x32). Antes o site não tinha ícone nenhum — abas e
 * bookmarks saíam com o glob default do navegador. Marca = ponto REC verde
 * (#7CF067 da Kaleidos) sobre preto, igual ao dot do logo na sidebar.
 */
export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#7CF067",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
