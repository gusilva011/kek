"use client";

import { useStore } from "@/store/useStore";

/**
 * Logo da marca. Usa a imagem enviada no backoffice (branding.logoDataUrl)
 * quando existir; caso contrário, mostra o logo padrão BrasilBet (SVG).
 */
export function BrandLogo({
  size = 32,
  showWordmark = true,
  override,
}: {
  size?: number;
  showWordmark?: boolean;
  /** Valores locais (ex.: pré-visualização no backoffice) em vez do store. */
  override?: { brandName?: string; logoDataUrl?: string };
}) {
  const storeBranding = useStore((s) => s.branding);
  const branding = override ?? storeBranding;
  const name = branding.brandName || "BrasilBet";

  return (
    <div className="flex items-center gap-2">
      {branding.logoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoDataUrl}
          alt={name}
          style={{ height: size }}
          className="w-auto rounded-md object-contain"
        />
      ) : (
        <DefaultMark size={size} />
      )}
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight">
          {splitName(name).map((part, i) => (
            <span key={i} className={i === 0 ? "text-white" : "text-brand"}>
              {part}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/** Divide o nome em duas partes para o wordmark bicolor (ex.: Brasil|Bet). */
function splitName(name: string): string[] {
  const m = name.match(/^(.*?)(bet)$/i);
  if (m && m[1]) return [m[1], m[2]];
  return [name];
}

function DefaultMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id="bbg" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#1bd47f" />
          <stop offset="1" stopColor="#0e9c5c" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#bbg)" />
      {/* acento amarelo (Brasil) */}
      <circle cx="32" cy="32" r="11" fill="#ffd23f" opacity="0.9" />
      {/* bola */}
      <circle cx="19" cy="19" r="10.5" fill="#ffffff" />
      <polygon points="19,15.4 22.42,17.89 21.12,21.91 16.88,21.91 15.58,17.89" fill="#0e9c5c" />
      <g stroke="#0e9c5c" strokeWidth="1.2" strokeLinecap="round">
        <line x1="19" y1="15.4" x2="19" y2="10.5" />
        <line x1="22.42" y1="17.89" x2="27.1" y2="16.4" />
        <line x1="21.12" y1="21.91" x2="24.0" y2="25.9" />
        <line x1="16.88" y1="21.91" x2="14.0" y2="25.9" />
        <line x1="15.58" y1="17.89" x2="10.9" y2="16.4" />
      </g>
    </svg>
  );
}
