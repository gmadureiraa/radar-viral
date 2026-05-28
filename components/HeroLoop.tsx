"use client";

/**
 * HeroLoop — vídeo abstrato gerado via Higgsfield (Kling 3.0) com ondas
 * concêntricas pulsando, sugerindo "radar/scan/onda viral propagando".
 *
 * Respeita `prefers-reduced-motion`: usuários com motion reduzido recebem
 * o poster estático em vez do vídeo em loop. Sem áudio, sem controles,
 * `playsInline` pra autoplay no iOS. Lazy: o vídeo só pesa quando entra
 * na viewport (objeto pequeno na landing).
 *
 * O CSS aplica um leve mask-image radial pra ele se misturar no fundo
 * paper/preto da landing sem borda dura.
 */

import { useEffect, useState } from "react";

export function HeroLoop() {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: 720,
    margin: "0 auto 40px",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    border: "1.5px solid var(--color-rdv-ink)",
    boxShadow: "10px 10px 0 0 var(--color-rdv-rec)",
    background: "var(--color-rdv-ink)",
  };

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    // Suave fade nas bordas pra ele "encaixar" no layout editorial
    maskImage:
      "radial-gradient(ellipse at center, black 70%, transparent 100%)",
    WebkitMaskImage:
      "radial-gradient(ellipse at center, black 70%, transparent 100%)",
  };

  if (prefersReduced) {
    return (
      <div style={wrapperStyle} aria-hidden="true">
        <img
          src="/generated/hero-poster.jpg"
          alt=""
          style={mediaStyle}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div style={wrapperStyle} aria-hidden="true">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/generated/hero-poster.jpg"
        style={mediaStyle}
      >
        <source src="/generated/hero.webm" type="video/webm" />
        <source src="/generated/hero.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
