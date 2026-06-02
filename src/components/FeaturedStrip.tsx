"use client";

import { useMemo } from "react";
import type { Match } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { leagueMeta, leaguePriority } from "@/lib/catalog";
import { ptTeam, ptLeague } from "@/lib/i18n";
import { OddsButton } from "./OddsButton";
import { LiveProgress } from "./LiveProgress";
import { TeamCrest } from "./ui/TeamCrest";
import { Icon } from "./ui/Icon";
import { Flag } from "./ui/Flag";
import { HScroller } from "./ui/HScroller";
import { formatKickoff } from "@/lib/format";

const INDIVIDUAL_SPORTS = new Set(["tennis", "mma", "boxing"]);

export function FeaturedStrip() {
  const matches = useStore((s) => s.matches);

  const featured = useMemo(() => {
    return Object.values(matches)
      .filter((m) => m.status !== "finished")
      .sort(
        (a, b) =>
          (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) ||
          leaguePriority(a.league) - leaguePriority(b.league) ||
          a.startsAt - b.startsAt,
      )
      .slice(0, 5);
  }, [matches]);

  if (featured.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="fire" size={16} className="text-gold" />
        <span className="text-sm font-bold text-white">Em destaque</span>
        <span className="text-xs text-slate-500">Principais jogos do momento</span>
      </div>
      <HScroller className="pb-1">
        {featured.map((m) => (
          <FeaturedCard key={m.id} match={m} />
        ))}
      </HScroller>
    </div>
  );
}

function FeaturedCard({ match }: { match: Match }) {
  const meta = leagueMeta(match.league);
  const openDetail = useStore((s) => s.openDetail);
  const market =
    match.markets.find((mk) => mk.key === "1x2" || mk.key === "ml") ?? match.markets[0];
  const live = match.status === "live";

  return (
    <div
      onClick={() => openDetail(match.id)}
      className="card-hover flex w-64 shrink-0 cursor-pointer flex-col rounded-2xl border border-white/5 bg-gradient-to-b from-ink-700/80 to-ink-800 p-3 shadow-card hover:border-white/10"
    >
      <div className="mb-2.5 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 truncate text-slate-400">
          <Flag code={meta.code} size={16} />
          <span className="truncate">{ptLeague(meta.short)}</span>
        </span>
        {live ? (
          <span className="flex items-center gap-1 rounded bg-live/15 px-1.5 py-0.5 font-bold text-live">
            <span className="h-1.5 w-1.5 animate-livePulse rounded-full bg-live" />
            {match.minute}&apos;
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded bg-ink-600 px-1.5 py-0.5 font-medium text-slate-300">
            <Icon name="clock" size={11} />
            {formatKickoff(match.startsAt)}
          </span>
        )}
      </div>

      <div className="mb-2 space-y-1.5">
        <Team name={match.home} score={live ? match.score.home : null} logo={match.homeLogo} player={INDIVIDUAL_SPORTS.has(match.sport)} />
        <Team name={match.away} score={live ? match.score.away : null} logo={match.awayLogo} player={INDIVIDUAL_SPORTS.has(match.sport)} />
      </div>

      {live ? <LiveProgress minute={match.minute} className="mb-3" /> : <div className="mb-3 h-1" />}

      <div className={`mt-auto grid gap-1 ${market.selections.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {market.selections.map((sel) => (
          <OddsButton key={sel.id} match={match} market={market} selection={sel} showLabel />
        ))}
      </div>
    </div>
  );
}

function Team({
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
        <span className="truncate text-sm font-medium text-slate-100">{ptTeam(name)}</span>
      </span>
      {score !== null && (
        <span className="shrink-0 text-sm font-bold tabular-nums text-white">{score}</span>
      )}
    </div>
  );
}
