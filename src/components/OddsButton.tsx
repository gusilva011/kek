"use client";

import { useEffect, useRef, useState } from "react";
import type { Market, Match, Selection } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { formatOdds } from "@/lib/format";
import { ptTeam } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

export function OddsButton({
  match,
  market,
  selection,
  showLabel = false,
}: {
  match: Match;
  market: Market;
  selection: Selection;
  showLabel?: boolean;
}) {
  const slip = useStore((s) => s.slip);
  const addSelection = useStore((s) => s.addSelection);
  const removeSelection = useStore((s) => s.removeSelection);

  const prev = useRef(selection.odds);
  const [flash, setFlash] = useState<"" | "up" | "down">("");

  useEffect(() => {
    if (selection.odds > prev.current) setFlash("up");
    else if (selection.odds < prev.current) setFlash("down");
    prev.current = selection.odds;
    const t = setTimeout(() => setFlash(""), 900);
    return () => clearTimeout(t);
  }, [selection.odds]);

  const selected = slip.some((s) => s.selectionId === selection.id);
  const suspended = selection.suspended;
  const disabled = suspended || match.status === "finished";

  const onClick = () => {
    if (disabled) return;
    if (selected) return removeSelection(selection.id);
    addSelection({
      matchId: match.id,
      matchLabel: `${match.home} x ${match.away}`,
      league: match.league,
      marketKey: market.key,
      marketName: market.name,
      selectionId: selection.id,
      selectionLabel: selection.label,
      oddsAtPick: selection.odds,
    });
  };

  const flashClass = flash === "up" ? "animate-flashUp" : flash === "down" ? "animate-flashDown" : "";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      data-testid={`odd:${selection.id}`}
      data-suspended={selection.suspended}
      className={[
        "group flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border text-center transition-all",
        flashClass,
        selected
          ? "border-brand bg-brand/15 text-white shadow-glow"
          : suspended
            ? "border-white/5 bg-ink-800/40 text-slate-500"
            : match.status === "finished"
              ? "border-white/5 bg-ink-700/40 text-slate-500 opacity-60"
              : "border-white/5 bg-ink-700/60 text-white hover:border-brand/50 hover:bg-ink-600",
        disabled ? "cursor-not-allowed" : "cursor-pointer active:scale-[0.97]",
      ].join(" ")}
    >
      {showLabel && (
        <span className="max-w-full truncate px-1 text-[10px] uppercase leading-none tracking-wide text-slate-400">
          {ptTeam(selection.label)}
        </span>
      )}
      {suspended ? (
        <span className="flex items-center text-slate-500" title="Mercado temporariamente suspenso">
          <Icon name="lock" size={14} />
        </span>
      ) : (
        <span className="flex items-center gap-0.5 text-sm font-bold tabular-nums">
          {flash === "up" && <span className="text-[9px] text-brand-light">▲</span>}
          {flash === "down" && <span className="text-[9px] text-live">▼</span>}
          {formatOdds(selection.odds)}
        </span>
      )}
    </button>
  );
}
