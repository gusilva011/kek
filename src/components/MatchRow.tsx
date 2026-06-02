"use client";

import { memo } from "react";
import type { Match, MarketKey } from "@/shared/types";
import { formatKickoff } from "@/lib/format";
import { useStore } from "@/store/useStore";
import { OddsButton } from "./OddsButton";
import { TeamCrest } from "./ui/TeamCrest";
import { Icon } from "./ui/Icon";
import { ptTeam } from "@/lib/i18n";

/**
 * Linha de jogo. Memoizada: como o board recebe os updates em lote
 * (`upsertMatches`) e só os jogos alterados trocam de referência, apenas as
 * linhas que mudaram re-renderizam — o resto do board fica estável (sem o
 * "freeze" de re-renderizar 80+ linhas a cada tick).
 */
export const MatchRow = memo(function MatchRow({ match, columnMarket }: { match: Match; columnMarket: MarketKey }) {
  const openDetail = useStore((s) => s.openDetail);
  const market =
    match.markets.find((m) => m.key === columnMarket) ??
    match.markets.find((m) => m.key === "1x2" || m.key === "ml") ??
    match.markets[0];
  const showScore = match.status === "live" || match.status === "finished";
  const player = INDIVIDUAL_SPORTS.has(match.sport);
  const cols = market.selections.length;
  const tmpl = cols === 3 ? "grid-cols-[repeat(3,3.4rem)]" : "grid-cols-[repeat(2,3.4rem)]";
  const livePct = Math.min(100, Math.round((match.minute / 90) * 100));

  return (
    <div
      onClick={() => openDetail(match.id)}
      className="group relative grid cursor-pointer grid-cols-[3rem_1fr_auto] items-center gap-2 border-t border-white/[0.04] px-3 py-2.5 transition-colors first:border-t-0 hover:bg-white/[0.03]"
    >
      <div className="flex flex-col items-center text-center">
        {match.status === "live" ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-live">
            <span className="h-1.5 w-1.5 animate-livePulse rounded-full bg-live" />
            {match.minute}&apos;
          </span>
        ) : match.status === "finished" ? (
          <span className="text-[11px] font-semibold text-slate-500">FIM</span>
        ) : (
          <span className="text-[11px] font-medium text-slate-400">{formatKickoff(match.startsAt)}</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">
          <TeamLine name={match.home} score={showScore ? match.score.home : null} logo={match.homeLogo} player={player} />
          <div className="mt-1" />
          <TeamLine name={match.away} score={showScore ? match.score.away : null} logo={match.awayLogo} player={player} />
        </div>
        <Icon
          name="chevronRight"
          size={14}
          className="shrink-0 text-slate-600 opacity-0 transition group-hover:opacity-100"
        />
      </div>

      <div className={`grid gap-1 ${tmpl}`}>
        {market.selections.map((sel) => (
          <OddsButton key={sel.id} match={match} market={market} selection={sel} />
        ))}
      </div>

      {match.status === "live" && (
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-live/70 transition-all duration-700"
          style={{ width: `${livePct}%` }}
        />
      )}
    </div>
  );
});

/** Esportes individuais: a "equipe" é um atleta → busca foto, não escudo. */
const INDIVIDUAL_SPORTS = new Set(["tennis", "mma", "boxing"]);

function TeamLine({
  name,
  score,
  logo,
  player,
}: {
  name: string;
  score: number | null;
  logo?: string;
  player?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        <TeamCrest name={name} size={24} logo={logo} player={player} />
        <span className="truncate text-sm text-slate-100">{ptTeam(name)}</span>
      </span>
      {score !== null && (
        <span className="shrink-0 text-sm font-bold tabular-nums text-white">{score}</span>
      )}
    </div>
  );
}
