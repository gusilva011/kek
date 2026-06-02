"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * Faixa com rolagem horizontal: arrastar com o mouse (desktop), setas que
 * aparecem ao passar o mouse, e toque/swipe no celular. Suprime o clique
 * acidental nos filhos quando houve arrasto.
 */
export function HScroller({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const onDown = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    drag.current = { active: true, startX: e.pageX, startLeft: el.scrollLeft, moved: false };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current.active) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const end = () => {
    drag.current.active = false;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  const scrollBy = (dir: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group relative">
      <div
        ref={ref}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={end}
        onMouseLeave={end}
        onClickCapture={onClickCapture}
        className={`flex cursor-grab gap-3 overflow-x-auto scroll-smooth no-scrollbar active:cursor-grabbing ${className}`}
      >
        {children}
      </div>

      {canL && (
        <Arrow side="left" onClick={() => scrollBy(-1)} />
      )}
      {canR && (
        <Arrow side="right" onClick={() => scrollBy(1)} />
      )}
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Anterior" : "Próximo"}
      className={[
        "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-ink-900/90 text-white opacity-0 shadow-pop backdrop-blur transition group-hover:opacity-100 hover:bg-ink-700 sm:flex",
        side === "left" ? "left-1" : "right-1",
      ].join(" ")}
    >
      <Icon name="chevronRight" size={18} className={side === "left" ? "rotate-180" : ""} />
    </button>
  );
}
