"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { MARKET_TABS } from "@/lib/catalog";
import type { StatusFilter } from "@/store/useStore";
import { Icon } from "./ui/Icon";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "live", label: "Ao Vivo" },
  { key: "upcoming", label: "Próximas" },
];

export function CenterControls() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const matches = useStore((s) => s.matches);

  const liveCount = useMemo(
    () => Object.values(matches).filter((m) => m.status === "live").length,
    [matches],
  );

  // Dias com jogos pré-live (abas estilo Betano), só do esporte atual.
  const days = useMemo(() => {
    if (filters.status !== "upcoming") return [];
    const today = startOfDay(Date.now());
    const set = new Set<number>();
    for (const m of Object.values(matches)) {
      if (m.status !== "upcoming") continue;
      if (filters.sport !== "all" && m.sport !== filters.sport) continue;
      const d = startOfDay(m.startsAt);
      if (d >= today) set.add(d); // só hoje em diante
    }
    return Array.from(set).sort((a, b) => a - b).slice(0, 8);
  }, [matches, filters.sport, filters.status]);

  const onStatus = (key: StatusFilter) => {
    // "Ao Vivo" mostra TODOS os jogos ao vivo (limpa liga). Trocar de aba zera o dia.
    if (key === "live") setFilters({ status: "live", league: null, day: null });
    else setFilters({ status: key, day: null });
  };

  return (
    <div className="mb-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-white/5 bg-ink-800 p-1">
          {STATUS_TABS.map((t) => {
            const active = filters.status === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onStatus(t.key)}
                className={[
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  active ? "bg-ink-600 text-white shadow-card" : "text-slate-400 hover:text-slate-200",
                ].join(" ")}
              >
                {t.key === "live" && <Icon name="live" size={14} className="text-live" />}
                {t.label}
                {t.key === "live" && liveCount > 0 && (
                  <span className="rounded bg-live/15 px-1.5 text-xs font-bold text-live">{liveCount}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-52 max-w-[42vw]">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Buscar time…"
            className="w-full rounded-xl border border-white/5 bg-ink-800 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-brand/60"
          />
        </div>
      </div>

      {/* Abas de dia (Próximas) — estilo Betano */}
      {filters.status === "upcoming" && days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <DayTab active={filters.day === null} onClick={() => setFilters({ day: null })}>
            Todos
          </DayTab>
          {days.map((d) => (
            <DayTab key={d} active={filters.day === d} onClick={() => setFilters({ day: d })}>
              {dayLabel(d)}
            </DayTab>
          ))}
        </div>
      )}

      {filters.sport === "football" && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {MARKET_TABS.map((m) => {
            const active = filters.columnMarket === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setFilters({ columnMarket: m.key })}
                className={[
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-brand/40 bg-brand/15 text-brand-light"
                    : "border-white/5 bg-ink-800 text-slate-400 hover:border-white/15 hover:text-slate-200",
                ].join(" ")}
              >
                {m.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayLabel(ts: number): string {
  const today = startOfDay(Date.now());
  const diff = Math.round((ts - today) / 86400000);
  const d = new Date(ts);
  const dm = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (diff === 0) return `Hoje ${dm}`;
  if (diff === 1) return `Amanhã ${dm}`;
  return `${WEEKDAYS[d.getDay()]} ${dm}`;
}

function DayTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-brand/40 bg-brand/15 text-brand-light"
          : "border-white/5 bg-ink-800 text-slate-400 hover:border-white/15 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
