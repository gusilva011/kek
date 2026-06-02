"use client";

import { useEffect, useState } from "react";
import { contrastText, initials, shade } from "@/lib/colors";
import { teamColor, teamFlagCode } from "@/lib/teams";
import { getTeamLogo, getPlayerPhoto } from "@/lib/logos";

/**
 * Escudo do time / foto do atleta:
 *  - `logo` fornecido (ex.: API-Football) → usa direto.
 *  - `player` (esportes individuais) → foto do atleta (TheSportsDB).
 *  - senão, seleção → bandeira; clube → escudo (TheSportsDB).
 *  - monograma colorido sempre por baixo (nunca fica em branco).
 */
export function TeamCrest({
  name,
  size = 22,
  logo,
  player,
}: {
  name: string;
  size?: number;
  logo?: string;
  player?: boolean;
}) {
  const flag = player ? null : teamFlagCode(name);
  if (logo) return <LogoCrest name={name} size={size} src={logo} />;
  if (flag) return <FlagCrest name={name} size={size} code={flag} />;
  if (player) return <PlayerCrest name={name} size={size} />;
  return <ClubCrest name={name} size={size} />;
}

function Monogram({ name, size, hidden }: { name: string; size: number; hidden?: boolean }) {
  const bg = teamColor(name);
  const fg = contrastText(bg);
  return (
    <span
      className="absolute inset-0 flex items-center justify-center rounded-full font-bold leading-none ring-1 ring-white/15 transition-opacity duration-300"
      style={{
        fontSize: Math.round(size * 0.4),
        background: `linear-gradient(150deg, ${shade(bg, 0.12)}, ${bg} 55%, ${shade(bg, -0.16)})`,
        color: fg,
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.28), inset 0 -2px 4px rgba(0,0,0,0.3)",
        opacity: hidden ? 0 : 1,
      }}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Escudo (logo) num "chip" CIRCULAR uniforme — escudo contido (object-contain
 * com folga) sobre um fundo sutil, com máscara redonda, para todos os logos
 * ficarem no mesmo formato profissional (sem quadrados feios). Enquanto carrega
 * (ou se falhar), mostra o monograma colorido.
 */
function LogoCrest({ name, size, src }: { name: string; size: number; src: string }) {
  const [ok, setOk] = useState(false);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        background: ok ? "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.12), rgba(255,255,255,0.04))" : undefined,
      }}
    >
      <Monogram name={name} size={size} hidden={ok} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity duration-300"
        style={{
          width: "72%",
          height: "72%",
          opacity: ok ? 1 : 0,
          filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.45))",
        }}
        onLoad={() => setOk(true)}
        onError={() => setOk(false)}
      />
    </span>
  );
}

function FlagCrest({ name, size, code }: { name: string; size: number; code: string }) {
  const [err, setErr] = useState(false);
  const bg = teamColor(name);
  const fg = contrastText(bg);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold leading-none ring-1 ring-white/20"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: bg, color: fg }}
    >
      {!err && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/w80/${code}.png`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setErr(true)}
        />
      )}
      {err && initials(name)}
    </span>
  );
}

function ClubCrest({ name, size }: { name: string; size: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getTeamLogo(name).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  if (src) return <LogoCrest name={name} size={size} src={src} />;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <Monogram name={name} size={size} />
    </span>
  );
}

/**
 * Atleta (tênis/MMA/boxe): foto/recorte do TheSportsDB sobre um fundo SÓLIDO
 * (sem a sigla por baixo — o cutout é transparente e deixava as iniciais
 * vazarem). Sem foto → monograma limpo.
 */
function PlayerCrest({ name, size }: { name: string; size: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getPlayerPhoto(name).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  if (!src) {
    return (
      <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
        <Monogram name={name} size={size} />
      </span>
    );
  }
  const bg = teamColor(name);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/15"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(150deg, ${shade(bg, 0.14)}, ${bg} 60%, ${shade(bg, -0.2)})`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setSrc(null)}
      />
    </span>
  );
}
