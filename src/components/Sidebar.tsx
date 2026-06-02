"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { sportMeta, leagueMeta, sportPriority, leaguePriority } from "@/lib/catalog";
import { ptLeague } from "@/lib/i18n";
import { Icon } from "./ui/Icon";
import { Flag } from "./ui/Flag";

export function Sidebar() {
  const matches = useStore((s) => s.matches);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

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

  const leagues = useMemo(() => {
    const map = new Map<string, { live: number; total: number; logo?: string; flag?: string; sport: string }>();
    for (const m of Object.values(matches)) {
      if (m.status === "finished") continue;
      if (filters.sport !== "all" && m.sport !== filters.sport) continue;
      const e = map.get(m.league) ?? { live: 0, total: 0, logo: m.leagueLogo, flag: m.leagueFlag, sport: m.sport };
      e.total++;
      if (m.status === "live") e.live++;
      map.set(m.league, e);
    }
    return Array.from(map.entries())
      .map(([league, e]) => ({ league, ...e }))
      .sort(
        (a, b) =>
          leaguePriority(a.league) - leaguePriority(b.league) ||
          b.live - a.live ||
          b.total - a.total ||
          a.league.localeCompare(b.league),
      );
  }, [matches, filters.sport]);

  const liveTotal = useMemo(
    () => Object.values(matches).filter((m) => m.status === "live").length,
    [matches],
  );

  return (
    <nav className="space-y-5 text-sm">
      <button
        onClick={() => setFilters({ status: "live", league: null })}
        className={[
          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 font-semibold transition",
          filters.status === "live"
            ? "border-live/40 bg-live/10 text-live"
            : "border-white/5 bg-ink-800 text-slate-200 hover:border-live/30",
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          <Icon name="live" size={17} />
          Ao Vivo
        </span>
        {liveTotal > 0 && (
          <span className="rounded-md bg-live/20 px-1.5 py-0.5 text-xs font-bold text-live">{liveTotal}</span>
        )}
      </button>

      <Section title="Esportes">
        {sports.map(({ sport, count }) => {
          const meta = sportMeta(sport);
          const active = filters.sport === sport;
          return (
            <button
              key={sport}
              onClick={() => setFilters({ sport, league: null, status: "all" })}
              className={[
                "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition",
                active ? "bg-ink-700 font-medium text-white" : "text-slate-300 hover:bg-white/5",
              ].join(" ")}
            >
              <span className="flex items-center gap-2.5">
                <Icon name={meta.icon} size={17} className={active ? "text-brand-light" : "text-slate-400"} />
                {meta.label}
              </span>
              <span className="rounded bg-white/5 px-1.5 text-[10px] font-bold text-slate-400">{count}</span>
            </button>
          );
        })}
      </Section>

      <Section title="Ligas">
        <button
          onClick={() => setFilters({ league: null })}
          className={[
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition",
            filters.league === null ? "text-white" : "text-slate-400 hover:text-slate-200",
          ].join(" ")}
        >
          <Icon name="star" size={14} className="text-gold" />
          Todas as ligas
        </button>
        {leagues.map(({ league, live, total, logo, flag, sport }) => {
          const meta = leagueMeta(league);
          const active = filters.league === league;
          return (
            <button
              key={league}
              onClick={() => setFilters({ league: active ? null : league })}
              className={[
                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition",
                active ? "bg-ink-700 text-white" : "text-slate-400 hover:bg-white/5",
              ].join(" ")}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex w-[18px] shrink-0 justify-center">
                  {meta.code ? (
                    <Flag code={meta.code} size={17} />
                  ) : logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="h-4 w-4 object-contain" />
                  ) : flag ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flag} alt="" className="h-3.5 w-auto rounded-[2px]" />
                  ) : (
                    <Icon name={sportMeta(sport).icon} size={15} className="text-slate-500" />
                  )}
                </span>
                <span className="truncate">{ptLeague(meta.short)}</span>
              </span>
              {live > 0 ? (
                <span className="shrink-0 rounded bg-live/15 px-1.5 text-[10px] font-bold text-live">{live}</span>
              ) : (
                <span className="shrink-0 rounded bg-white/5 px-1.5 text-[10px] font-bold text-slate-500">{total}</span>
              )}
            </button>
          );
        })}
      </Section>

      <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-ink-800 p-3 text-[11px] leading-relaxed text-slate-500">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-brand-light" />
        <span>Aposte com responsabilidade. Plataforma demonstrativa — dinheiro fictício. +18.</span>
      </div>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="max-h-[40vh] space-y-0.5 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}
