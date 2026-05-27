"use client";

/**
 * SkeletonCard — placeholder de carregamento pra grids de cards (IG/YT/etc).
 *
 * Usa só tokens --color-rdv-* + shimmer auto-contido via styled-jsx, então
 * funciona nos dois temas sem tocar em globals.css. Aspect ratio configurável
 * pra casar com cada tipo de card (16/9 vídeo, 4/5 post, 9/16 reel).
 */
export function SkeletonCard({
  aspectRatio = "16/9",
  media = true,
}: {
  aspectRatio?: string;
  /** Quando false, omite o bloco de mídia (pra cards de texto, ex. Threads). */
  media?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="rdv-card rdv-skeleton-card"
      style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      {media && <div className="rdv-skeleton-shimmer" style={{ aspectRatio, width: "100%" }} />}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="rdv-skeleton-shimmer" style={{ height: 9, width: "55%" }} />
        <div className="rdv-skeleton-shimmer" style={{ height: 13, width: "92%" }} />
        <div className="rdv-skeleton-shimmer" style={{ height: 13, width: "70%" }} />
        {!media && <div className="rdv-skeleton-shimmer" style={{ height: 13, width: "40%" }} />}
      </div>
      <style jsx>{`
        .rdv-skeleton-shimmer {
          background: linear-gradient(
            90deg,
            var(--color-rdv-soft) 0%,
            var(--color-rdv-line) 50%,
            var(--color-rdv-soft) 100%
          );
          background-size: 200% 100%;
          animation: rdv-skeleton-slide 1.3s ease-in-out infinite;
        }
        @keyframes rdv-skeleton-slide {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rdv-skeleton-shimmer {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
