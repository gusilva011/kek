"use client";

import { useEffect, useState } from "react";
import type { Banner } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { Icon } from "./ui/Icon";

export function HeroBanners() {
  const banners = useStore((s) => s.banners);
  const openAuth = useStore((s) => s.openAuth);
  const active = banners.filter((b) => b.active).sort((a, b) => a.order - b.order);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (active.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % active.length), 6000);
    return () => clearInterval(t);
  }, [active.length]);

  if (active.length === 0) return null;
  const current = active[Math.min(idx, active.length - 1)];

  const go = (delta: number) => setIdx((i) => (i + delta + active.length) % active.length);

  const onCta = (b: Banner) => {
    if (b.ctaHref === "#cadastro") openAuth("register");
    else if (b.ctaHref === "#jogos") window.scrollTo({ top: 440, behavior: "smooth" });
    else if (b.ctaHref?.startsWith("http")) window.open(b.ctaHref, "_blank");
  };

  return (
    <div className="mb-4">
      <div className="group relative isolate min-h-[200px] overflow-hidden rounded-2xl border border-white/10 shadow-card sm:min-h-[256px]">
        {/* Slides empilhados (crossfade) */}
        {active.map((b, i) => (
          <div
            key={b.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === idx ? "opacity-100" : "opacity-0"}`}
            aria-hidden={i !== idx}
          >
            {b.videoUrl ? (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                src={b.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                aria-hidden
              />
            ) : b.imageUrl ? (
              <div
                className="absolute inset-0 animate-kenburns bg-cover bg-center"
                style={{ backgroundImage: `url(${b.imageUrl})` }}
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${b.bg}`} />
            )}
            {/* Overlays p/ legibilidade do texto */}
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/55 to-ink-950/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
          </div>
        ))}

        {/* Brilho decorativo */}
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid-fade" />

        {/* Conteúdo */}
        <div className="relative flex min-h-[200px] flex-col justify-center p-6 sm:min-h-[256px] sm:p-9">
          <div key={current.id} className="max-w-lg animate-slideUp">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-light backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-livePulse rounded-full bg-brand" />{" "}
              {current.badge?.trim() || "BrasilBet"}
            </span>
            <h2 className="text-2xl font-extrabold leading-[1.1] text-white drop-shadow-lg sm:text-[2rem]">
              {current.title}
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/85 sm:text-base">{current.subtitle}</p>
            {current.ctaLabel && (
              <button
                onClick={() => onCta(current)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-ink-950 shadow-glow transition hover:scale-[1.03] hover:bg-brand-light active:scale-100"
              >
                {current.ctaLabel}
                <Icon name="chevronRight" size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Setas (desktop, no hover) */}
        {active.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Banner anterior"
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 opacity-0 backdrop-blur transition hover:bg-black/55 hover:text-white group-hover:opacity-100 sm:block"
            >
              <Icon name="chevronRight" size={18} className="rotate-180" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Próximo banner"
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 opacity-0 backdrop-blur transition hover:bg-black/55 hover:text-white group-hover:opacity-100 sm:block"
            >
              <Icon name="chevronRight" size={18} />
            </button>
          </>
        )}

        {/* Indicadores */}
        {active.length > 1 && (
          <div className="absolute bottom-3.5 left-6 flex gap-1.5 sm:left-9">
            {active.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-7 bg-brand" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                aria-label={`Ir para o banner ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
