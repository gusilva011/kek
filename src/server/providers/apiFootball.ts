/**
 * Adaptador API-Football (api-sports.io / dashboard.api-football.com).
 *
 * Cobertura AMPLA (1.200+ ligas/copas) + logos de times e ligas. Modelo:
 *  - /fixtures?date=YYYY-MM-DD  → todos os jogos do dia (nomes, logos, status).
 *  - /odds?date=YYYY-MM-DD&page=N → odds por jogo (paginado), com vários mercados.
 * Juntamos os dois por fixture id. Plano grátis = 100 req/dia, então buscamos
 * poucos dias e limitamos páginas (cota gerenciada pelo cache + refresh longo).
 */

import type { Market, Match } from "../../shared/types";
import { makeSelectionId } from "../../shared/ids";
import { synthesizeMarkets } from "./synthOdds";
import { ptMarketName, ptValue } from "../../lib/i18n";

const BASE = "https://v3.football.api-sports.io";
const DAYS = 3; // hoje + 2
const MAX_ODDS_PAGES = 6; // por dia

function headers(key: string) {
  return { "x-apisports-key": key };
}

function ymd(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

const LIVE_STATUS = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const SKIP_STATUS = new Set(["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO", "SUSP"]);

interface FixtureInfo {
  id: string;
  league: string;
  country: string;
  leagueLogo?: string;
  leagueFlag?: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  startsAt: number;
  live: boolean;
  minute: number;
  score: { home: number; away: number };
}

interface ApiBetValue {
  value: string;
  odd: string;
}
interface ApiBet {
  id: number;
  name: string;
  values: ApiBetValue[];
}

function num(v: string): number {
  return Math.round(parseFloat(v) * 100) / 100;
}
function sanitize(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "x";
}

/** Converte os mercados (bets) da API-Football no nosso formato. */
function normalizeBets(fid: string, home: string, away: string, bets: ApiBet[]): Market[] {
  const out: Market[] = [];
  const byName = new Map(bets.map((b) => [b.name, b]));
  const val = (b: ApiBet | undefined, name: string) => b?.values.find((v) => v.value === name)?.odd;

  const mk = (key: string, name: string, sels: { sk: string; label: string; odd?: string }[]) => {
    const selections = sels
      .filter((s) => s.odd)
      .map((s) => ({ id: makeSelectionId(fid, key, s.sk), label: s.label, odds: num(s.odd!), suspended: false }));
    if (selections.length >= 2) out.push({ key, name, selections });
  };

  // Resultado final (1x2) ou vencedor (ml)
  const mw = byName.get("Match Winner");
  if (mw) {
    const h = val(mw, "Home"), d = val(mw, "Draw"), a = val(mw, "Away");
    if (h && d && a) {
      mk("1x2", "Resultado Final", [
        { sk: "home", label: home, odd: h },
        { sk: "draw", label: "Empate", odd: d },
        { sk: "away", label: away, odd: a },
      ]);
    } else if (h && a) {
      mk("ml", "Vencedor", [
        { sk: "home", label: home, odd: h },
        { sk: "away", label: away, odd: a },
      ]);
    }
  }

  // Total de gols 2.5
  const ou = byName.get("Goals Over/Under");
  if (ou) {
    mk("ou25", "Total de Gols 2.5", [
      { sk: "over", label: "Mais 2.5", odd: val(ou, "Over 2.5") },
      { sk: "under", label: "Menos 2.5", odd: val(ou, "Under 2.5") },
    ]);
  }

  // Ambos marcam
  const btts = byName.get("Both Teams Score");
  if (btts) {
    mk("btts", "Ambos Marcam", [
      { sk: "yes", label: "Sim", odd: val(btts, "Yes") },
      { sk: "no", label: "Não", odd: val(btts, "No") },
    ]);
  }

  // Dupla chance
  const dc = byName.get("Double Chance");
  if (dc) {
    mk("dc", "Dupla Chance", [
      { sk: "1x", label: "Casa ou Empate (1X)", odd: val(dc, "Home/Draw") },
      { sk: "12", label: "Casa ou Fora (12)", odd: val(dc, "Home/Away") },
      { sk: "x2", label: "Empate ou Fora (X2)", odd: val(dc, "Draw/Away") },
    ]);
  }

  // Empate anula (Home/Away = draw no bet)
  const dnb = byName.get("Home/Away");
  if (dnb) {
    mk("dnb", "Empate Anula Aposta", [
      { sk: "home", label: home, odd: val(dnb, "Home") },
      { sk: "away", label: away, odd: val(dnb, "Away") },
    ]);
  }

  // Vencedor do 1º tempo
  const fh = byName.get("First Half Winner");
  if (fh) {
    mk("1h_1x2", "Vencedor 1º Tempo", [
      { sk: "home", label: home, odd: val(fh, "Home") },
      { sk: "draw", label: "Empate", odd: val(fh, "Draw") },
      { sk: "away", label: away, odd: val(fh, "Away") },
    ]);
  }

  // Par/Ímpar
  const oe = byName.get("Odd/Even");
  if (oe) {
    mk("oddeven", "Total Par/Ímpar", [
      { sk: "odd", label: "Ímpar", odd: val(oe, "Odd") },
      { sk: "even", label: "Par", odd: val(oe, "Even") },
    ]);
  }

  // --- GENÉRICO: inclui TODOS os demais tipos de aposta que a API retorna
  // (placar exato, handicap, escanteios, cartões, 1º/2º tempo, etc.), com nome e
  // seleções traduzidos. É o que garante "todos os mercados".
  const handled = new Set([
    "Match Winner",
    "Goals Over/Under",
    "Both Teams Score",
    "Double Chance",
    "Home/Away",
    "First Half Winner",
    "Odd/Even",
  ]);
  for (const b of bets) {
    if (handled.has(b.name)) continue;
    const seen = new Set<string>();
    const selections = [];
    for (const v of b.values) {
      const odd = Number(v.odd);
      if (!Number.isFinite(odd) || odd < 1.01) continue;
      const vstr = String(v.value);
      let sk = sanitize(vstr);
      while (seen.has(sk)) sk += "_";
      seen.add(sk);
      selections.push({ id: makeSelectionId(fid, sanitize(b.name), sk), label: ptValue(vstr, home, away), odds: num(v.odd), suspended: false });
      if (selections.length >= 18) break; // cap (placar exato tem dezenas)
    }
    if (selections.length >= 2) out.push({ key: sanitize(b.name), name: ptMarketName(b.name), selections });
  }

  return out;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface CollectOpts {
  /** Offset do primeiro dia (0 = hoje, -1 = ontem). Default 0. */
  startDayOffset?: number;
  /** Quantos dias a partir do primeiro (default 3). */
  days?: number;
  /** Teto de páginas de odds por dia (default 6). */
  maxOddsPages?: number;
  /** Teto total de requisições — protege a cota diária (default: sem teto). */
  requestBudget?: number;
  /** Pausa entre requisições em ms — respeita o limite por minuto (default 0). */
  throttleMs?: number;
  /** Inclui jogos já encerrados (útil na demo, que reanima tudo). Default false. */
  includeFinished?: boolean;
  /**
   * Vitrine demo: gera odds sintéticas (modelo Poisson) para os fixtures REAIS
   * sem odds na API free, enchendo o board com todos os jogos. Default false
   * (o provedor ao vivo mostra só odds reais).
   */
  synthesizeMissing?: boolean;
  /** Teto de jogos no resultado (usado com `synthesizeMissing`). Default 500. */
  targetMatches?: number;
  /** Callback de progresso/diagnóstico. */
  log?: (msg: string) => void;
}

interface ApiGetResult {
  json: any;
  /** Cota DIÁRIA restante (header x-ratelimit-requests-remaining). */
  remainingDay: number | null;
  /** True só para limite REAL (429 ou cota/requests) — aí paramos tudo. */
  hardLimit: boolean;
}

async function apiGet(path: string, key: string): Promise<ApiGetResult> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(key) });
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    /* corpo vazio ou inválido */
  }
  // A API-Football usa `errors` tanto para limite real quanto para avisos não
  // fatais (ex.: plano sem acesso àquela data). Só o limite real deve parar tudo.
  const errStr = JSON.stringify(json?.errors ?? "").toLowerCase();
  const hardLimit = res.status === 429 || /reached the request|requests limit|rate limit|too many/.test(errStr);
  return {
    json,
    remainingDay: rem !== null && rem !== "" ? Number(rem) : null,
    hardLimit,
  };
}

/**
 * Busca jogos reais na API-Football (fixtures + odds, juntados por id).
 * Sem `opts`, usa os defaults do feed real (3 dias, 6 páginas, sem throttle).
 * O colhedor da demo passa `opts` amplos + orçamento de cota.
 */
export async function fetchApiFootballMatches(key: string, opts: CollectOpts = {}): Promise<Match[]> {
  const startOffset = opts.startDayOffset ?? 0;
  const days = opts.days ?? DAYS;
  const maxOddsPages = opts.maxOddsPages ?? MAX_ODDS_PAGES;
  const budget = opts.requestBudget ?? Infinity;
  const throttle = opts.throttleMs ?? 0;
  const includeFinished = opts.includeFinished ?? false;
  const log = opts.log ?? (() => {});
  const dates = Array.from({ length: days }, (_, i) => ymd(startOffset + i));

  let reqCount = 0;
  let remainingDay: number | null = null;
  let stop = false;
  const canRequest = () => !stop && reqCount < budget && (remainingDay === null || remainingDay > 1);

  // 1) Jogos (nomes, logos, status)
  const fixtures = new Map<string, FixtureInfo>();
  for (const date of dates) {
    if (!canRequest()) break;
    const { json, remainingDay: rem, hardLimit } = await apiGet(`/fixtures?date=${date}`, key);
    reqCount++;
    if (rem !== null) remainingDay = rem;
    if (hardLimit) {
      stop = true;
      log(`[api-football] limite de cota atingido (fixtures ${date}).`);
      break;
    }
    for (const f of json.response ?? []) {
      const st: string = f.fixture.status.short;
      if (!includeFinished && SKIP_STATUS.has(st)) continue;
      fixtures.set(String(f.fixture.id), {
        id: String(f.fixture.id),
        league: f.league.name,
        country: f.league.country,
        leagueLogo: f.league.logo,
        leagueFlag: f.league.flag,
        home: f.teams.home.name,
        away: f.teams.away.name,
        homeLogo: f.teams.home.logo,
        awayLogo: f.teams.away.logo,
        startsAt: new Date(f.fixture.date).getTime(),
        live: LIVE_STATUS.has(st),
        minute: f.fixture.status.elapsed ?? 0,
        score: { home: f.goals.home ?? 0, away: f.goals.away ?? 0 },
      });
    }
    if (throttle && canRequest()) await sleep(throttle);
  }

  // 2) Odds (paginado, limitado pelo orçamento)
  const oddsByFixture = new Map<string, ApiBet[]>();
  for (const date of dates) {
    if (!canRequest()) break;
    let page = 1;
    let total = 1;
    do {
      if (!canRequest()) break;
      const { json, remainingDay: rem, hardLimit } = await apiGet(`/odds?date=${date}&page=${page}`, key);
      reqCount++;
      if (rem !== null) remainingDay = rem;
      if (hardLimit) {
        stop = true;
        log(`[api-football] limite de cota atingido (odds ${date} p${page}).`);
        break;
      }
      total = json.paging?.total ?? 1;
      for (const o of json.response ?? []) {
        const bk = o.bookmakers?.[0];
        if (bk?.bets) oddsByFixture.set(String(o.fixture.id), bk.bets);
      }
      page++;
      if (throttle && canRequest()) await sleep(throttle);
    } while (page <= total && page <= maxOddsPages);
  }

  // 3) Junta + normaliza
  const toMatch = (info: FixtureInfo, markets: Market[]): Match => ({
    id: info.id,
    sport: "football",
    league: info.league,
    home: info.home,
    away: info.away,
    status: info.live ? "live" : "upcoming",
    startsAt: info.startsAt,
    minute: info.minute,
    score: info.score,
    markets,
    marketsLoaded: true,
    homeLogo: info.homeLogo,
    awayLogo: info.awayLogo,
    leagueLogo: info.leagueLogo,
    leagueFlag: info.leagueFlag,
    country: info.country,
  });

  // 3a) Jogos com odds REAIS.
  const matches: Match[] = [];
  for (const info of fixtures.values()) {
    const bets = oddsByFixture.get(info.id);
    if (!bets) continue;
    const markets = normalizeBets(info.id, info.home, info.away, bets);
    if (markets.length === 0) continue;
    matches.push(toMatch(info, markets));
  }
  const withReal = matches.length;

  // 3b) Vitrine demo: completa o board com os demais fixtures REAIS, sintetizando
  // odds plausíveis, até o teto. Embaralha para variar as ligas no preenchimento.
  let synthCount = 0;
  if (opts.synthesizeMissing) {
    const target = opts.targetMatches ?? 500;
    const noOdds = Array.from(fixtures.values()).filter((f) => !oddsByFixture.has(f.id));
    for (let i = noOdds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [noOdds[i], noOdds[j]] = [noOdds[j], noOdds[i]];
    }
    for (const info of noOdds) {
      if (matches.length >= target) break;
      matches.push(toMatch(info, synthesizeMarkets(info.id, info.home, info.away)));
      synthCount++;
    }
  }

  const msg = `[api-football] ${fixtures.size} fixtures → ${matches.length} jogos (${withReal} odds reais${
    synthCount ? ` + ${synthCount} sintetizadas` : ""
  }), ${reqCount} req${remainingDay !== null ? `, cota restante ~${remainingDay}` : ""}`;
  console.log(msg);
  log(msg);
  return matches;
}

/* ------------------------------------------------------------------ */
/* Jogos REAIS ao vivo agora (/fixtures?live=all) — usado pelo modo live */
/* ------------------------------------------------------------------ */

export interface LiveFixture {
  id: string;
  league: string;
  country: string;
  leagueLogo?: string;
  leagueFlag?: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  minute: number;
  score: { home: number; away: number };
  startsAt: number;
  /** True quando o jogo encerrou (FT/AET/PEN) — para liquidar. */
  finished: boolean;
  /** Cota DIÁRIA restante reportada pela API (header). */
  remainingDay: number | null;
}

const DONE_STATUS = new Set(["FT", "AET", "PEN"]);

/**
 * Busca os jogos REALMENTE ao vivo agora (1 requisição cobre o mundo todo).
 * Inclui também os que acabaram de encerrar (FT) para permitir a liquidação.
 */
export async function fetchLiveFixtures(
  key: string,
): Promise<{ fixtures: LiveFixture[]; remainingDay: number | null; hardLimit: boolean }> {
  const { json, remainingDay, hardLimit } = await apiGet(`/fixtures?live=all`, key);
  if (hardLimit) {
    return { fixtures: [], remainingDay, hardLimit: true };
  }
  const fixtures: LiveFixture[] = [];
  for (const f of json.response ?? []) {
    const st: string = f.fixture.status.short;
    fixtures.push({
      id: String(f.fixture.id),
      league: f.league.name,
      country: f.league.country,
      leagueLogo: f.league.logo,
      leagueFlag: f.league.flag,
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeLogo: f.teams.home.logo,
      awayLogo: f.teams.away.logo,
      minute: f.fixture.status.elapsed ?? 0,
      score: { home: f.goals.home ?? 0, away: f.goals.away ?? 0 },
      startsAt: new Date(f.fixture.date).getTime(),
      finished: DONE_STATUS.has(st),
      remainingDay,
    });
  }
  return { fixtures, remainingDay, hardLimit: false };
}
