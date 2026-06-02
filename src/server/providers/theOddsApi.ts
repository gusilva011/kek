/**
 * Adaptador para The Odds API (the-odds-api.com) — fornecedor de odds reais
 * mais barato para começar (grátis 500 req/mês; pago a partir de US$ 30/mês).
 *
 * Este módulo converte a resposta deles no NOSSO formato `Match`, de modo que o
 * resto da plataforma (board, boletim, liquidação) funcione igual com dados
 * reais. Não é ligado por padrão — veja o README ("Fornecedor de odds real").
 *
 * Endpoint:
 *   GET https://api.the-odds-api.com/v4/sports/{sportKey}/odds
 *       ?apiKey=SUA_CHAVE&regions=eu&markets=h2h,totals&oddsFormat=decimal
 */

import type { Match, Market } from "../../shared/types";
import { makeSelectionId } from "../../shared/ids";

const BASE = "https://api.the-odds-api.com/v4";

/**
 * Nomes (pt-BR) para os sport keys conhecidos. As competições ATIVAS são
 * descobertas dinamicamente em /sports — keys fora deste mapa usam o título da
 * própria API. Assim puxamos TUDO que a API oferece e adapta à temporada.
 */
const SPORT_META: Record<string, string> = {
  soccer_fifa_world_cup: "Copa do Mundo",
  soccer_conmebol_copa_libertadores: "Libertadores",
  soccer_conmebol_copa_sudamericana: "Sul-Americana",
  soccer_brazil_campeonato: "Brasileirão Série A",
  soccer_brazil_serie_b: "Brasileirão Série B",
  soccer_japan_j_league: "J-League",
  soccer_sweden_allsvenskan: "Allsvenskan",
  soccer_chile_campeonato: "Primera División (Chile)",
  soccer_china_superleague: "Super League (China)",
  soccer_norway_eliteserien: "Eliteserien (Noruega)",
  soccer_spain_segunda_division: "La Liga 2 (Espanha)",
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A (ITA)",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_france_ligue_one: "Ligue 1",
  soccer_uefa_champs_league: "Champions League",
};

interface SportRow {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights: boolean;
}

/** Grupo do The Odds API → chave de esporte interna. */
const GROUP_SPORT: Record<string, string> = {
  Soccer: "football",
  Basketball: "basketball",
  Tennis: "tennis",
  "Mixed Martial Arts": "mma",
  Boxing: "boxing",
  Baseball: "baseball",
  "Ice Hockey": "icehockey",
  "American Football": "americanfootball",
  Cricket: "cricket",
  "Rugby League": "rugby",
  "Aussie Rules": "aussierules",
  Handball: "handball",
  Lacrosse: "lacrosse",
};

export function groupToSport(group: string): string {
  return GROUP_SPORT[group] ?? group.toLowerCase().replace(/[^a-z]+/g, "");
}

/** Descobre TODAS as competições ATIVAS (todos os esportes; não gasta cota). */
async function fetchActiveSports(apiKey: string): Promise<{ key: string; league: string; group: string }[]> {
  const res = await fetch(`${BASE}/sports?apiKey=${apiKey}`);
  if (!res.ok) return [];
  const sports = (await res.json()) as SportRow[];
  return sports
    .filter((s) => s.active && !s.has_outrights && s.group !== "Politics" && !s.key.endsWith("_winner"))
    .map((s) => ({ key: s.key, league: SPORT_META[s.key] ?? s.title, group: s.group }));
}

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}
interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}
interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}
interface OddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

function priceByName(outcomes: OddsApiOutcome[] | undefined, name: string): number | undefined {
  return outcomes?.find((o) => o.name === name)?.price;
}

/** Converte um evento do The Odds API no nosso `Match` (pré-jogo). */
function normalize(ev: OddsApiEvent, league: string, sportKey: string, group: string): Match | null {
  const book = ev.bookmakers?.[0];
  if (!book) return null;

  const h2h = book.markets.find((m) => m.key === "h2h");
  const totals = book.markets.find((m) => m.key === "totals");

  const markets: Market[] = [];

  if (h2h) {
    const home = priceByName(h2h.outcomes, ev.home_team);
    const away = priceByName(h2h.outcomes, ev.away_team);
    const draw = priceByName(h2h.outcomes, "Draw");
    if (home && away && draw) {
      // 3 vias (futebol): Casa / Empate / Fora
      markets.push({
        key: "1x2",
        name: "Resultado Final",
        selections: [
          { id: makeSelectionId(ev.id, "1x2", "home"), label: ev.home_team, odds: home, suspended: false },
          { id: makeSelectionId(ev.id, "1x2", "draw"), label: "Empate", odds: draw, suspended: false },
          { id: makeSelectionId(ev.id, "1x2", "away"), label: ev.away_team, odds: away, suspended: false },
        ],
      });
    } else if (home && away) {
      // 2 vias (basquete/tênis/MMA/etc.): Vencedor
      markets.push({
        key: "ml",
        name: "Vencedor",
        selections: [
          { id: makeSelectionId(ev.id, "ml", "home"), label: ev.home_team, odds: home, suspended: false },
          { id: makeSelectionId(ev.id, "ml", "away"), label: ev.away_team, odds: away, suspended: false },
        ],
      });
    }
  }

  if (totals) {
    const line = totals.outcomes.find((o) => o.point === 2.5) ? 2.5 : totals.outcomes[0]?.point;
    const over = totals.outcomes.find((o) => o.name === "Over" && o.point === line)?.price;
    const under = totals.outcomes.find((o) => o.name === "Under" && o.point === line)?.price;
    if (over && under) {
      const totName = group === "Soccer" ? `Total de Gols ${line}` : `Total ${line}`;
      markets.push({
        key: "ou25",
        name: totName,
        selections: [
          { id: makeSelectionId(ev.id, "ou25", "over"), label: `Mais ${line}`, odds: over, suspended: false },
          { id: makeSelectionId(ev.id, "ou25", "under"), label: `Menos ${line}`, odds: under, suspended: false },
        ],
      });
    }
  }

  if (markets.length === 0) return null;

  const startsAt = new Date(ev.commence_time).getTime();
  return {
    id: ev.id,
    sport: groupToSport(group),
    league,
    home: ev.home_team,
    away: ev.away_team,
    status: startsAt > Date.now() ? "upcoming" : "live",
    startsAt,
    minute: 0,
    score: { home: 0, away: 0 },
    markets,
    providerSportKey: sportKey,
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface OddsApiOpts {
  /** Teto de requisições às ligas (protege a cota mensal). Default: sem teto. */
  requestBudget?: number;
  /** Pausa entre requisições (ms). Default 0. */
  throttleMs?: number;
  /** Inclui mercado de total (Over/Under) além do vencedor. Default true. */
  withTotals?: boolean;
  log?: (msg: string) => void;
}

/** Busca e normaliza as partidas de todas as ligas/esportes ativos. */
export async function fetchOddsApiMatches(apiKey: string, opts: OddsApiOpts = {}): Promise<Match[]> {
  const budget = opts.requestBudget ?? Infinity;
  const throttle = opts.throttleMs ?? 0;
  const withTotals = opts.withTotals ?? true;
  const log = opts.log ?? (() => {});

  const all: Match[] = [];
  const comps = await fetchActiveSports(apiKey);
  log(`[odds-api] ${comps.length} competições ativas (todos os esportes)`);

  let reqCount = 0;
  let remainingMonth: number | null = null;
  for (const { key, league, group } of comps) {
    if (reqCount >= budget) break;
    const mkts = withTotals ? "h2h,totals" : "h2h";
    const url = `${BASE}/sports/${key}/odds?apiKey=${apiKey}&regions=eu&markets=${mkts}&oddsFormat=decimal`;
    const res = await fetch(url);
    reqCount++;
    const remaining = res.headers.get("x-requests-remaining");
    if (remaining) remainingMonth = Number(remaining);
    if (!res.ok) {
      log(`[odds-api] ${key}: HTTP ${res.status}`);
      if (res.status === 401 || res.status === 429) break; // chave/cota — para tudo
      continue;
    }
    const events = (await res.json()) as OddsApiEvent[];
    let added = 0;
    for (const ev of events) {
      const m = normalize(ev, league, key, group);
      if (m) {
        all.push(m);
        added++;
      }
    }
    if (added > 0) log(`[odds-api] ${league}: ${added} jogos${remaining ? ` · cota ${remaining}` : ""}`);
    if (throttle && reqCount < budget) await sleep(throttle);
  }
  log(`[odds-api] ✅ ${all.length} jogos de ${reqCount} ligas${remainingMonth !== null ? ` · cota mensal ~${remainingMonth}` : ""}`);
  return all;
}

/* ------------------------------------------------------------------ */
/* Mercados estendidos (detalhe do jogo) — endpoint por evento         */
/* ------------------------------------------------------------------ */

const EVENT_MARKETS_SOCCER = "h2h,totals,btts,double_chance,draw_no_bet";
const EVENT_MARKETS_OTHER = "h2h,totals,spreads";

const MARKET_NAME: Record<string, string> = {
  spreads: "Handicap",
  team_totals: "Total por Time",
};

function sanitize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "x";
}

function dcLabel(name: string, home: string, away: string): string {
  const drawish = /draw|empate/i.test(name);
  const h = name.includes(home);
  const a = name.includes(away);
  if (h && a) return "Casa ou Fora (12)";
  if (h && drawish) return "Casa ou Empate (1X)";
  if (a && drawish) return "Empate ou Fora (X2)";
  return name;
}

function normalizeEventMarket(ev: OddsApiEvent, m: OddsApiMarket): Market | null {
  const home = ev.home_team;
  const away = ev.away_team;
  const eid = ev.id;
  const mk = (key: string, name: string, sels: { sk: string; label: string; price: number }[]): Market => ({
    key,
    name,
    selections: sels.map((s) => ({
      id: makeSelectionId(eid, key, s.sk),
      label: s.label,
      odds: s.price,
      suspended: false,
    })),
  });

  if (m.key === "h2h") {
    const h = priceByName(m.outcomes, home);
    const a = priceByName(m.outcomes, away);
    const d = priceByName(m.outcomes, "Draw");
    if (h && a && d) {
      return mk("1x2", "Resultado Final", [
        { sk: "home", label: home, price: h },
        { sk: "draw", label: "Empate", price: d },
        { sk: "away", label: away, price: a },
      ]);
    }
    if (h && a) {
      return mk("ml", "Vencedor", [
        { sk: "home", label: home, price: h },
        { sk: "away", label: away, price: a },
      ]);
    }
    return null;
  }

  if (m.key === "totals") {
    const point = m.outcomes.find((o) => o.point === 2.5)?.point ?? m.outcomes[0]?.point;
    if (point == null) return null;
    const over = m.outcomes.find((o) => o.name === "Over" && o.point === point)?.price;
    const under = m.outcomes.find((o) => o.name === "Under" && o.point === point)?.price;
    if (!over || !under) return null;
    const key = point === 2.5 ? "ou25" : `ou_${point}`;
    return mk(key, `Total de Gols ${point}`, [
      { sk: "over", label: `Mais ${point}`, price: over },
      { sk: "under", label: `Menos ${point}`, price: under },
    ]);
  }

  if (m.key === "btts") {
    const yes = priceByName(m.outcomes, "Yes");
    const no = priceByName(m.outcomes, "No");
    if (!yes || !no) return null;
    return mk("btts", "Ambos Marcam", [
      { sk: "yes", label: "Sim", price: yes },
      { sk: "no", label: "Não", price: no },
    ]);
  }

  if (m.key === "draw_no_bet") {
    const h = priceByName(m.outcomes, home);
    const a = priceByName(m.outcomes, away);
    if (!h || !a) return null;
    return mk("dnb", "Empate Anula Aposta", [
      { sk: "home", label: home, price: h },
      { sk: "away", label: away, price: a },
    ]);
  }

  if (m.key === "double_chance") {
    const sels = m.outcomes
      .filter((o) => o.price)
      .map((o) => ({ sk: sanitize(o.name), label: dcLabel(o.name, home, away), price: o.price }));
    if (sels.length < 2) return null;
    return mk("dc", "Dupla Chance", sels);
  }

  // Genérico (handicap e demais)
  const sels = m.outcomes
    .filter((o) => o.price)
    .map((o) => ({
      sk: sanitize(o.name) + (o.point != null ? `_${o.point}` : ""),
      label: o.point != null ? `${o.name} ${o.point > 0 ? "+" : ""}${o.point}` : o.name,
      price: o.price,
    }));
  if (sels.length === 0) return null;
  return mk(m.key, MARKET_NAME[m.key] ?? m.key, sels);
}

/** Busca os mercados estendidos de um evento específico (detalhe do jogo). */
export async function fetchEventMarkets(apiKey: string, sportKey: string, eventId: string): Promise<Market[]> {
  const marketsParam = sportKey.startsWith("soccer") ? EVENT_MARKETS_SOCCER : EVENT_MARKETS_OTHER;
  const url = `${BASE}/sports/${sportKey}/events/${eventId}/odds?apiKey=${apiKey}&regions=eu&markets=${marketsParam}&oddsFormat=decimal`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[odds-api] evento ${eventId}: HTTP ${res.status}`);
    return [];
  }
  const ev = (await res.json()) as OddsApiEvent;
  const book = ev.bookmakers?.[0];
  if (!book) return [];
  const markets: Market[] = [];
  for (const m of book.markets) {
    const nm = normalizeEventMarket(ev, m);
    if (nm) markets.push(nm);
  }
  const remaining = res.headers.get("x-requests-remaining");
  if (remaining) console.log(`[odds-api] detalhe ${eventId}: ${markets.length} mercados · cota ${remaining}`);
  return markets;
}
