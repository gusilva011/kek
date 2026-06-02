"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { sportMeta, sportPriority } from "@/lib/catalog";
import { Icon } from "./ui/Icon";
import { HScroller } from "./ui/HScroller";

export function SportsRibbon() {
  const matches = useStore((s) => s.matches);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const live = filters.status === "live";

  const sports = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of Object.values(matches)) {
      if (m.status === "finished") continue;
      map.set(m.sport, (map.get(m.sport) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([sport, count]) => ({ sport, count }))
      .sort((a, b) => sportPriority(a.sport) - sportPriority(b.sport) || b.count - a.count);
  }, [matches]);

  return (
    <div className="mb-4 rounded-xl border border-white/5 bg-ink-850/60 p-2">
      <HScroller className="items-center gap-2">
        <Pill live active={live} onClick={() => setFilters({ status: "live", league: null })}>
          <Icon name="live" size={15} />
          Ao Vivo
        </Pill>
        <span className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />
        {sports.map(({ sport, count }) => {
          const meta = sportMeta(sport);
          return (
            <Pill
              key={sport}
              active={!live && filters.sport === sport}
              onClick={() => setFilters({ sport, league: null, status: "all" })}
            >
              <Icon name={meta.icon} size={16} />
              {meta.label}
              <span className="rounded bg-white/10 px-1 text-[10px] font-bold">{count}</span>
            </Pill>
          );
        })}
      </HScroller>
    </div>
  );
}

function Pill({
  children,
  active,
  live,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  live?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
        active
          ? live
            ? "bg-live/15 text-live"
            : "bg-brand/15 text-brand-light ring-1 ring-brand/30"
          : "text-slate-300 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
