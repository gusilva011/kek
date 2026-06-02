"use client";

import { useEffect, useRef, useState } from "react";
import { initials, textTint } from "@/lib/colors";
import { teamColor, teamFlagCode } from "@/lib/teams";
import { getTeamLogo, getPlayerPhoto } from "@/lib/logos";

/**
 * Símbolo do competidor — PADRONIZADO, sem caixa/anel/bola atrás:
 *  - Seleção nacional → bandeira do país (círculo).
 *  - Atleta (tênis/MMA/boxe) → foto/recorte SEM nada atrás (só o jogador).
 *  - Clube com `logo` → SÓ o escudo (contido, flutuando, sem caixa/anel).
 *  - Sem logo/foto → monograma num disco ESCURO discreto (iniciais na cor do time).
 *
 * Nada de fundo branco/claro: só um escudo/foto real (transparente) flutuando, ou
 * um disco escuro sutil quando não há imagem.
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
  if (flag) return <FlagCrest name={name} size={size} code={flag} />;
  if (player) return <PhotoCrest name={name} size={size} src={logo} />;
  if (logo) return <LogoCrest name={name} size={size} src={logo} />;
  return <ClubCrest name={name} size={size} />;
}

/** Disco ESCURO discreto — só aparece quando NÃO há imagem (monograma/loading). */
const MONO_BG = "linear-gradient(150deg, #2b3442, #161b23)";

/** Monograma: disco escuro + iniciais na cor (clara) do time. Nunca um quadrado branco. */
function Monogram({ name, size, hidden }: { name: string; size: number; hidden?: boolean }) {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center rounded-full font-bold leading-none transition-opacity duration-300"
      style={{
        fontSize: Math.round(size * 0.4),
        background: MONO_BG,
        color: textTint(teamColor(name)),
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.06)",
        opacity: hidden ? 0 : 1,
      }}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Escudo de clube: SÓ o símbolo. `object-contain` num quadrado, SEM fundo, sem
 * anel — o escudo "flutua" com uma leve sombra. Enquanto carrega (ou se falhar),
 * mostra o disco escuro do monograma por baixo.
 */
function LogoCrest({ name, size, src }: { name: string; size: number; src: string }) {
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Imagem em CACHE já pode estar "complete" antes de o onLoad ligar (no reload) —
  // sem isto o logo ficava invisível (opacity 0) com o monograma por cima.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setOk(true);
  }, [src]);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <Monogram name={name} size={size} hidden={ok} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
        style={{
          opacity: ok ? 1 : 0,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))",
        }}
        onLoad={() => setOk(true)}
        onError={() => setOk(false)}
      />
    </span>
  );
}

/** Clube sem logo do provedor: busca o escudo (TheSportsDB) e cai no monograma. */
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

/** Bandeira de seleção nacional num círculo limpo (borda interna sutil, sem anel). */
function FlagCrest({ name, size, code }: { name: string; size: number; code: string }) {
  const [err, setErr] = useState(false);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
      }}
    >
      {!err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/w80/${code}.png`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        <Monogram name={name} size={size} />
      )}
    </span>
  );
}

/**
 * Atleta (tênis/MMA/boxe): foto/recorte SÓ do jogador — SEM disco/bola atrás.
 * O recorte (cutout) do TheSportsDB é transparente, então com fundo transparente
 * sobra só o atleta sobre o board. Sem foto → disco escuro do monograma.
 * `src` pode vir do acervo (backfill) ou da busca client-side.
 */
function PhotoCrest({ name, size, src }: { name: string; size: number; src?: string }) {
  const [url, setUrl] = useState<string | null>(src ?? null);
  useEffect(() => {
    if (src) {
      setUrl(src);
      return;
    }
    let alive = true;
    getPlayerPhoto(name).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [name, src]);

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {/* disco escuro só enquanto carrega / sem foto */}
      <Monogram name={name} size={size} hidden={!!url} />
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "50% 16%", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}
          onError={() => setUrl(null)}
        />
      )}
    </span>
  );
}
