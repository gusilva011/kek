"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/**
 * Bandeira da competição. Usa flagcdn (cobre todos os países por código ISO).
 * Competições sem país (Copa do Mundo / continentais) usam um selo de troféu.
 * Código desconhecido / falha → selo neutro (nunca quebra).
 */

const TROPHY: Record<string, { from: string; to: string }> = {
  wc: { from: "#d4af37", to: "#a8841f" },
  cont: { from: "#0fa968", to: "#0b6b43" },
};

export function Flag({ code, size = 18 }: { code: string; size?: number }) {
  const [err, setErr] = useState(false);
  const w = size;
  const h = Math.round(size * 0.72);
  const trophy = TROPHY[code];

  if (trophy) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-[4px] text-white ring-1 ring-black/30"
        style={{ width: w, height: h, background: `linear-gradient(135deg, ${trophy.from}, ${trophy.to})` }}
      >
        <Icon name="trophy" size={Math.round(size * 0.6)} />
      </span>
    );
  }

  if (!code || err) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-[3px] bg-ink-600 text-slate-400 ring-1 ring-black/30"
        style={{ width: w, height: h }}
      >
        <Icon name="football" size={Math.round(size * 0.62)} />
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/30"
      style={{ width: w, height: h }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setErr(true)}
      />
    </span>
  );
}
