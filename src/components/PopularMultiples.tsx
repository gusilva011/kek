"use client";

import { useMemo } from "react";
import type { Market, Match, MultipleLeg, Selection } from "@/shared/types";
import { useStore, type SlipSelection } from "@/store/useStore";
import { leaguePriority, leagueMeta } from "@/lib/catalog";
import { ptTeam } from "@/lib/i18n";
import { formatOdds } from "@/lib/format";
import { Icon } from "./ui/Icon";
import { Flag } from "./ui/Flag";
import { HScroller } from "./ui/HScroller";

/** Mercados de resultado (vencedor) usados na geração automática. */
const RESULT_MARKETS = new Set(["1x2", "ml", "h2h", "moneyline"]);
const PER_CARD = 4;
const MAX_CARDS = 6;
const FAKE_POPULARITY = [620, 540, 480, 410, 360, 300];

/** Perna normalizada para exibição (vale para múltipla curada e automática). */
type DisplayLeg = {
  key: string;
  matchId: string;
  name: string;
  matchLabel: string;
  leagueCode: string;
  odds: number;
  available: boolean;
  slip: SlipSelection;
};
type Card = { id: string; legs: DisplayLeg[]; popularity: number; combined: number };

function prettyMatch(label: string): string {
  const p = label.split(" x ");
  return p.length === 2 ? `${ptTeam(p[0])} - ${ptTeam(p[1])}` : label;
}

function pickMarket(m: Match): Market | undefined {
  return m.markets.find((mk) => RESULT_MARKETS.has(mk.key));
}
function legNameAuto(match: Match, market: Market, sel: Selection): string {
  const idx = market.selections.indexOf(sel);
  if (market.selections.length >= 3 && idx === 1) return "Empate";
  if (idx === market.selections.length - 1) return ptTeam(match.away);
  return ptTeam(match.home);
}

/** Resolve uma perna curada contra os jogos vivos (odds atuais; fallback snapshot). */
function resolveCurated(leg: MultipleLeg, matches: Record<string, Match>): DisplayLeg {
  const match = matches[leg.matchId];
  let odds = leg.oddsAtPick;
  let selectionLabel = leg.selectionLabel;
  let marketName = leg.marketName;
  let available = false;
  if (match) {
    const market = match.markets.find((mk) => mk.key === leg.marketKey);
    const sel = market?.selections.find((s) => s.id === leg.selectionId);
    if (sel && !sel.suspended) {
      odds = sel.odds;
      selectionLabel = sel.label;
      marketName = market!.name;
      available = true;
    }
  }
  return {
    key: leg.selectionId,
    matchId: leg.matchId,
    name: ptTeam(selectionLabel),
    matchLabel: prettyMatch(leg.matchLabel),
    leagueCode: leagueMeta(leg.league).code,
    odds,
    available,
    slip: {
      matchId: leg.matchId,
      matchLabel: leg.matchLabel,
      league: leg.league,
      marketKey: leg.marketKey,
      marketName,
      selectionId: leg.selectionId,
      selectionLabel,
      oddsAtPick: odds,
    },
  };
}

export function PopularMultiples() {
  const matches = useStore((s) => s.matches);
  const curated = useStore((s) => s.popularMultiples);
  const addSelection = useStore((s) => s.addSelection);
  const setMobileSheet = useStore((s) => s.setMobileSheet);
  const openDetail = useStore((s) => s.openDetail);
  const pushToast = useStore((s) => s.pushToast);

  const cards = useMemo<Card[]>(() => {
    // 1) Múltiplas CURADAS pelo backoffice (se houver ativas).
    const active = curated.filter((m) => m.active && m.legs.length > 0).sort((a, b) => a.order - b.order);
    if (active.length > 0) {
      return active.map((m, i) => {
        const legs = m.legs.map((l) => resolveCurated(l, matches));
        const combined = legs.reduce((acc, l) => acc * l.odds, 1);
        return { id: m.id, legs, popularity: m.popularity || FAKE_POPULARITY[i] || 280, combined };
      });
    }

    // 2) Fallback automático: favorito de cada jogo real (mercado de resultado).
    const pool: DisplayLeg[] = [];
    for (const match of Object.values(matches)) {
      if (match.status === "finished") continue;
      const market = pickMarket(match);
      if (!market) continue;
      const sels = market.selections.filter((s) => !s.suspended && s.odds > 1);
      if (sels.length < 2) continue;
      const sel = sels.reduce((a, b) => (b.odds < a.odds ? b : a));
      pool.push({
        key: sel.id,
        matchId: match.id,
        name: legNameAuto(match, market, sel),
        matchLabel: `${ptTeam(match.home)} - ${ptTeam(match.away)}`,
        leagueCode: leagueMeta(match.league).code,
        odds: sel.odds,
        available: true,
        slip: {
          matchId: match.id,
          matchLabel: `${match.home} x ${match.away}`,
          league: match.league,
          marketKey: market.key,
          marketName: market.name,
          selectionId: sel.id,
          selectionLabel: sel.label,
          oddsAtPick: sel.odds,
        },
      });
    }
    pool.sort(
      (a, b) =>
        leaguePriority(matches[a.matchId]?.league ?? "") - leaguePriority(matches[b.matchId]?.league ?? "") ||
        a.matchId.localeCompare(b.matchId),
    );
    const out: Card[] = [];
    for (let i = 0; i + PER_CARD <= pool.length && out.length < MAX_CARDS; i += PER_CARD) {
      const legs = pool.slice(i, i + PER_CARD);
      out.push({
        id: `auto_${i}`,
        legs,
        popularity: FAKE_POPULARITY[out.length] ?? 280,
        combined: legs.reduce((acc, l) => acc * l.odds, 1),
      });
    }
    return out;
  }, [matches, curated]);

  if (cards.length === 0) return null;

  const addMultiple = (legs: DisplayLeg[]) => {
    for (const l of legs) addSelection(l.slip);
    pushToast({ kind: "success", message: `${legs.length} seleções adicionadas ao bilhete!` });
    setMobileSheet("slip");
  };

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="fire" size={16} className="text-gold" />
        <span className="text-sm font-bold text-white">Múltiplas Populares</span>
        <span className="hidden text-xs text-slate-500 sm:inline">
          Combinações em alta — toque para adicionar ao bilhete
        </span>
      </div>

      <HScroller className="gap-3 pb-1">
        {cards.map((card) => (
          <MultipleCard
            key={card.id}
            card={card}
            onAdd={() => addMultiple(card.legs)}
            onMore={() => card.legs[0] && openDetail(card.legs[0].matchId)}
          />
        ))}
      </HScroller>
    </div>
  );
}

function MultipleCard({ card, onAdd, onMore }: { card: Card; onAdd: () => void; onMore: () => void }) {
  const fill = Math.min(100, Math.round((card.legs.length / 6) * 100));

  return (
    <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-ink-700/70 to-ink-850 shadow-card sm:w-[330px]">
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-gradient-to-r from-gold/15 to-transparent px-4 py-2.5">
        <Icon name="fire" size={14} className="text-gold" />
        <span className="text-xs font-bold text-white">{card.popularity}+ apostas feitas</span>
      </div>

      <div className="flex-1 divide-y divide-white/5 px-4">
        {card.legs.map((l) => (
          <div key={l.key} className="flex items-center gap-2 py-2.5">
            <Flag code={l.leagueCode} size={18} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{l.name}</div>
              <div className="truncate text-[11px] text-slate-500">{l.matchLabel}</div>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-white">{formatOdds(l.odds)}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onMore}
        className="mx-4 mb-3 mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2 text-xs font-semibold text-slate-300 transition hover:border-brand/50 hover:text-white"
      >
        <Icon name="plus" size={13} />
        Adicionar mais seleções
      </button>

      <div className="border-t border-white/5 bg-ink-900/50 px-4 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="rounded-md bg-gold/20 px-1.5 py-0.5 text-[11px] font-extrabold text-gold">10%</span>
          <span className="text-xs font-bold uppercase tracking-wide text-white">SuperMúltipla</span>
        </div>
        <p className="mb-2 text-[11px] leading-snug text-slate-400">
          Adicione essas seleções e desbloqueie o bônus de SuperMúltipla!
        </p>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${fill}%` }} />
          </div>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[9px] font-black text-gold">
            %
          </span>
        </div>
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-bold text-ink-950 shadow-glow transition hover:bg-brand-light active:scale-[0.99]"
        >
          Adicionar ao bilhete <span className="tabular-nums">@ {card.combined.toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
}
