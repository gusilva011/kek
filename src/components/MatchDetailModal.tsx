"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { loadMarkets } from "@/lib/ws";
import { formatKickoff } from "@/lib/format";
import { leagueMeta } from "@/lib/catalog";
import { ptTeam, ptLeague, ptMarketName } from "@/lib/i18n";
import { Icon } from "./ui/Icon";
import { Flag } from "./ui/Flag";
import { TeamCrest } from "./ui/TeamCrest";
import { OddsButton } from "./OddsButton";

export function MatchDetailModal() {
  const matchId = useStore((s) => s.detailMatchId);
  const close = useStore((s) => s.closeDetail);
  const match = useStore((s) => (matchId ? s.matches[matchId] : undefined));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    loadMarkets(matchId).finally(() => setLoading(false));
  }, [matchId]);

  if (!matchId || !match) return null;
  const meta = leagueMeta(match.league);
  const player = match.sport === "tennis" || match.sport === "mma" || match.sport === "boxing";

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={close}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg animate-slideUp flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-ink-850 shadow-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-white/5 bg-gradient-to-b from-ink-800 to-ink-850 p-4">
          <button
            onClick={close}
            className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <Icon name="close" size={18} />
          </button>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            {meta.code ? (
              <Flag code={meta.code} size={15} />
            ) : match.leagueLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.leagueLogo} alt="" className="h-4 w-4 object-contain" />
            ) : null}
            {ptLeague(meta.short)} · {formatKickoff(match.startsAt)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <TeamCrest name={match.home} size={42} logo={match.homeLogo} player={player} />
              <span className="text-center text-sm font-semibold text-white">{ptTeam(match.home)}</span>
            </div>
            <span className="text-sm font-bold text-slate-500">VS</span>
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <TeamCrest name={match.away} size={42} logo={match.awayLogo} player={player} />
              <span className="text-center text-sm font-semibold text-white">{ptTeam(match.away)}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {match.markets.map((market) => (
            <div key={market.key}>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{ptMarketName(market.name)}</div>
              <div className={`grid gap-2 ${market.selections.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {market.selections.map((sel) => (
                  <OddsButton key={sel.id} match={match} market={market} selection={sel} showLabel />
                ))}
              </div>
            </div>
          ))}

          {loading && !match.marketsLoaded && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-brand" />
              Carregando mais mercados…
            </div>
          )}
          {match.marketsLoaded && (
            <p className="pt-1 text-center text-[11px] text-slate-600">
              {match.markets.length} mercado(s) disponível(is) para este jogo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
