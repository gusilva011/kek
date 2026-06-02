"use client";

import { memo, useMemo } from "react";
import type { MarketKey, Market, Match } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { leagueMeta, columnLabels, sportMeta, leaguePriority } from "@/lib/catalog";
import { ptLeague, ptCountry } from "@/lib/i18n";
import { MatchRow } from "./MatchRow";
import { Icon } from "./ui/Icon";
import { Flag } from "./ui/Flag";

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Mercado exibido no board para um jogo: o selecionado, ou o vencedor (1x2/ml). */
function displayMarket(m: Match, columnMarket: string): Market {
  return (
    m.markets.find((mk) => mk.key === columnMarket) ??
    m.markets.find((mk) => mk.key === "1x2" || mk.key === "ml") ??
    m.markets[0]
  );
}

export function LeagueGroups() {
  const matches = useStore((s) => s.matches);
  const filters = useStore((s) => s.filters);
  const conn = useStore((s) => s.conn);

  const { groups, totalCount, shownCount } = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const live = filters.status === "live";
    const startOfToday = startOfDay(Date.now());
    const list = Object.values(matches).filter((m) => {
      if (m.status === "finished") return false;
      if (filters.sport !== "all" && m.sport !== filters.sport) return false;
      if (filters.status !== "all" && m.status !== filters.status) return false;
      // Esconde pré-jogos com horário no passado (acervo antigo) — só ao vivo
      // pode ter horário passado.
      if (m.status === "upcoming" && m.startsAt < startOfToday) return false;
      // "Ao Vivo" mostra TODOS os jogos ao vivo, independente da liga selecionada.
      if (filters.league && !live && m.league !== filters.league) return false;
      // Filtro de dia (abas estilo Betano) — só vale na view "Próximas".
      if (filters.status === "upcoming" && filters.day != null && startOfDay(m.startsAt) !== filters.day) return false;
      if (q && !`${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q)) return false;
      return true;
    });

    // Board grande (centenas de jogos): renderizar tudo de uma vez sobrecarrega o
    // DOM. Na visão geral ("Todas as ligas", sem busca) mostramos os mais
    // relevantes (ao vivo + próximos); ligas específicas mostram tudo. Todos os
    // jogos seguem acessíveis pela barra lateral de ligas e pelos contadores.
    const total = list.length;
    const BOARD_LIMIT = 160;
    const capped = !filters.league && !q && total > BOARD_LIMIT;
    const shown = capped
      ? [...list]
          .sort((a, b) => {
            if (a.status !== b.status) return a.status === "live" ? -1 : 1;
            if (a.status === "live") return b.minute - a.minute;
            return a.startsAt - b.startsAt;
          })
          .slice(0, BOARD_LIMIT)
      : list;

    const byLeague = new Map<string, Match[]>();
    for (const m of shown) {
      if (!byLeague.has(m.league)) byLeague.set(m.league, []);
      byLeague.get(m.league)!.push(m);
    }

    const sortMatches = (a: Match, b: Match) => {
      if (a.status !== b.status) return a.status === "live" ? -1 : 1;
      if (a.status === "live") return b.minute - a.minute;
      return a.startsAt - b.startsAt;
    };

    const grouped = Array.from(byLeague.entries())
      .map(([league, ms]) => {
        ms.sort(sortMatches);
        return {
          league,
          matches: ms,
          live: ms.filter((m) => m.status === "live").length,
          // "Próximo evento" da liga: ao vivo = agora (0); pré-jogo = menor horário.
          soonest: Math.min(...ms.map((m) => (m.status === "live" ? 0 : m.startsAt))),
          sport: ms[0].sport,
          market: displayMarket(ms[0], filters.columnMarket),
          leagueLogo: ms[0].leagueLogo,
          leagueFlag: ms[0].leagueFlag,
          country: ms[0].country,
        };
      })
      // Ligas com jogo AO VIVO primeiro; depois por HORÁRIO crescente (o que começa
      // antes vem antes — não deixa jogo de 11/06 na frente dos de hoje).
      .sort((a, b) => {
        const al = a.live > 0 ? 0 : 1;
        const bl = b.live > 0 ? 0 : 1;
        return (
          al - bl ||
          a.soonest - b.soonest ||
          leaguePriority(a.league) - leaguePriority(b.league) ||
          a.league.localeCompare(b.league)
        );
      });
    return { groups: grouped, totalCount: total, shownCount: shown.length };
  }, [matches, filters]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-500">
        <Icon name={conn !== "open" ? "live" : "search"} size={28} className="text-slate-600" />
        {conn !== "open" ? "Conectando ao servidor de odds…" : "Nenhum evento para este filtro."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shownCount < totalCount && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-white/5 bg-ink-800/50 px-3.5 py-2.5 text-xs text-slate-400">
          <span>
            Mostrando os <b className="text-slate-200">{shownCount}</b> jogos em destaque de{" "}
            <b className="text-brand-light">{totalCount}</b> disponíveis.
          </span>
          <span className="text-slate-500">Escolha uma liga na lateral para ver todos →</span>
        </div>
      )}
      {groups.map((g) => (
        <LeagueSection key={g.league} group={g} columnMarket={filters.columnMarket} />
      ))}
    </div>
  );
}

interface LeagueGroupData {
  league: string;
  matches: Match[];
  live: number;
  soonest: number;
  sport: string;
  market: Market;
  leagueLogo?: string;
  leagueFlag?: string;
  country?: string;
}

/**
 * Uma liga: cabeçalho + linhas. Memoizada com comparação por REFERÊNCIA dos
 * jogos — como o board recebe os updates em lote (`upsertMatches`) e só os jogos
 * alterados trocam de referência, uma liga sem mudanças é pulada por completo.
 * Só as ligas com jogo ao vivo alterado re-renderizam a cada tick, mantendo o
 * board fluido mesmo com muitas ligas/jogos.
 */
const LeagueSection = memo(
  function LeagueSection({ group, columnMarket }: { group: LeagueGroupData; columnMarket: MarketKey }) {
    const { league, matches: ms, live, sport, market, leagueLogo, leagueFlag, country } = group;
    const meta = leagueMeta(league);
    const labels = columnLabels(market);
    const tmpl = labels.length === 3 ? "grid-cols-[repeat(3,3.4rem)]" : "grid-cols-[repeat(2,3.4rem)]";
    return (
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800/80 shadow-card">
        <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 border-b border-white/5 bg-white/[0.02] px-3 py-2.5">
          <span className="flex justify-center">
            {meta.code ? (
              <Flag code={meta.code} size={22} />
            ) : leagueLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={leagueLogo} alt="" className="h-5 w-5 object-contain" />
            ) : leagueFlag ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={leagueFlag} alt="" className="h-4 w-auto rounded-[2px]" />
            ) : (
              <Icon name={sportMeta(sport).icon} size={18} className="text-slate-400" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-bold text-slate-200">{ptLeague(meta.short)}</span>
              {live > 0 && (
                <span className="flex items-center gap-1 rounded bg-live/15 px-1.5 text-[10px] font-bold text-live">
                  <span className="h-1 w-1 animate-livePulse rounded-full bg-live" />
                  {live} ao vivo
                </span>
              )}
            </div>
            <div className="truncate text-[10px] text-slate-500">
              {meta.country || ptCountry(country) || sportMeta(sport).label}
            </div>
          </div>
          <div className={`grid gap-1 ${tmpl}`}>
            {labels.map((l, i) => (
              <span key={i} className="text-center text-[10px] font-bold uppercase text-slate-500">
                {l}
              </span>
            ))}
          </div>
        </div>

        {ms.map((m) => (
          <MatchRow key={m.id} match={m} columnMarket={columnMarket} />
        ))}
      </div>
    );
  },
  (prev, next) => {
    if (prev.columnMarket !== next.columnMarket || prev.group.league !== next.group.league) return false;
    const a = prev.group.matches;
    const b = next.group.matches;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; // refs estáveis ⇒ liga inalterada
    return true;
  },
);
