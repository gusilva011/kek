/**
 * Motor de simulação do sportsbook.
 *
 * Gera partidas, faz as odds evoluírem em tempo real, simula gols (com
 * suspensão momentânea dos mercados, como nas casas reais), avança o relógio
 * do jogo e finaliza as partidas. Emite eventos que o gateway WebSocket
 * retransmite aos clientes.
 *
 * Para trocar pela alimentação real (Sportradar, Genius, etc.), basta um
 * adaptador que produza os mesmos eventos `match_update` / `match_finished`.
 */

import { EventEmitter } from "events";
import type { Match, Market, MatchStatus, Score } from "../shared/types";
import { makeSelectionId } from "../shared/ids";
import { computeProbabilities, probToOdds, jitter } from "./odds";

const TICK_MS = 2000;
/** Minutos de jogo que passam a cada tick (acelerado para a demo). */
const MIN_PER_TICK = 1.5;
/** Ticks que um mercado fica suspenso após um gol. */
const SUSPEND_TICKS = 2;
/** Ticks que uma partida finalizada fica visível antes de sair do board. */
const KEEP_FINISHED_TICKS = 5;
/** Quantidade-alvo de partidas no board. */
const TARGET_MATCHES = 10;

interface SimState {
  lambdaHome: number;
  lambdaAway: number;
  suspendTicks: number;
  minuteFloat: number;
  removeAtTick: number | null;
}

interface TeamDef {
  name: string;
  /** Rating ofensivo/defensivo agregado (~60–92). */
  rating: number;
}

interface LeagueDef {
  name: string;
  teams: TeamDef[];
}

const LEAGUES: LeagueDef[] = [
  {
    name: "Brasileirão Série A",
    teams: [
      { name: "Flamengo", rating: 86 },
      { name: "Palmeiras", rating: 87 },
      { name: "Botafogo", rating: 83 },
      { name: "Atlético-MG", rating: 80 },
      { name: "São Paulo", rating: 79 },
      { name: "Corinthians", rating: 76 },
      { name: "Grêmio", rating: 77 },
      { name: "Internacional", rating: 78 },
      { name: "Fluminense", rating: 75 },
      { name: "Cruzeiro", rating: 76 },
    ],
  },
  {
    name: "Premier League",
    teams: [
      { name: "Manchester City", rating: 91 },
      { name: "Arsenal", rating: 88 },
      { name: "Liverpool", rating: 89 },
      { name: "Manchester United", rating: 82 },
      { name: "Chelsea", rating: 81 },
      { name: "Tottenham", rating: 80 },
      { name: "Newcastle", rating: 80 },
      { name: "Aston Villa", rating: 78 },
    ],
  },
  {
    name: "La Liga",
    teams: [
      { name: "Real Madrid", rating: 92 },
      { name: "Barcelona", rating: 89 },
      { name: "Atlético de Madrid", rating: 85 },
      { name: "Athletic Bilbao", rating: 79 },
      { name: "Real Sociedad", rating: 78 },
      { name: "Villarreal", rating: 77 },
      { name: "Real Betis", rating: 76 },
      { name: "Sevilla", rating: 76 },
    ],
  },
  {
    name: "Serie A (ITA)",
    teams: [
      { name: "Inter de Milão", rating: 87 },
      { name: "Napoli", rating: 85 },
      { name: "Juventus", rating: 84 },
      { name: "Milan", rating: 83 },
      { name: "Atalanta", rating: 82 },
      { name: "Roma", rating: 80 },
      { name: "Lazio", rating: 79 },
      { name: "Fiorentina", rating: 77 },
    ],
  },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Amostra de uma Poisson (algoritmo de Knuth) — número de gols num período. */
function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/** Converte ratings em gols esperados (lambda) de cada lado em 90'. */
function lambdasFor(homeRating: number, awayRating: number) {
  const BASE = 1.35;
  const diff = (homeRating - awayRating) / 45;
  const lambdaHome = clamp(BASE * (1 + diff) + 0.25, 0.4, 3.3);
  const lambdaAway = clamp(BASE * (1 - diff), 0.3, 3.0);
  return { lambdaHome, lambdaAway };
}

let matchCounter = 0;

export class SimulationEngine extends EventEmitter {
  private matches = new Map<string, Match>();
  private sim = new Map<string, SimState>();
  private tickCount = 0;
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.timer) return;
    // Semeia o board: algumas partidas ao vivo (minutos variados) e algumas
    // a começar em breve.
    for (let i = 0; i < 5; i++) this.createMatch("live");
    for (let i = 0; i < 5; i++) this.createMatch("upcoming");
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getMatches(): Match[] {
    return Array.from(this.matches.values());
  }

  getMatch(id: string): Match | undefined {
    return this.matches.get(id);
  }

  /** Localiza uma seleção (para validar aposta / calcular cashout). */
  getSelection(matchId: string, marketKey: string, selectionId: string) {
    const match = this.matches.get(matchId);
    if (!match) return null;
    const market = match.markets.find((m) => m.key === marketKey);
    if (!market) return null;
    const selection = market.selections.find((s) => s.id === selectionId);
    if (!selection) return null;
    return { match, market, selection };
  }

  /* ---------------------------------------------------------------- */

  private createMatch(status: MatchStatus): Match {
    const league = pick(LEAGUES);
    const home = pick(league.teams);
    let away = pick(league.teams);
    while (away.name === home.name) away = pick(league.teams);

    const { lambdaHome, lambdaAway } = lambdasFor(home.rating, away.rating);
    const id = `m_${++matchCounter}`;

    let minute = 0;
    const score: Score = { home: 0, away: 0 };
    let startsAt = Date.now();

    if (status === "live") {
      minute = Math.floor(5 + Math.random() * 65); // 5'–70'
      const frac = minute / 90;
      score.home = poissonSample(lambdaHome * frac);
      score.away = poissonSample(lambdaAway * frac);
    } else {
      // Começa entre 15s e 2min (demo). Em produção seria o horário real.
      startsAt = Date.now() + (15 + Math.random() * 105) * 1000;
    }

    const match: Match = {
      id,
      sport: "football",
      league: league.name,
      home: home.name,
      away: away.name,
      status,
      startsAt,
      minute,
      score,
      markets: [],
    };
    const sim: SimState = {
      lambdaHome,
      lambdaAway,
      suspendTicks: 0,
      minuteFloat: minute,
      removeAtTick: null,
    };
    match.markets = this.buildMarkets(match, sim, false);

    this.matches.set(id, match);
    this.sim.set(id, sim);
    this.emit("match_update", match);
    return match;
  }

  private buildMarkets(match: Match, sim: SimState, applyJitter: boolean): Market[] {
    const minute = match.status === "live" ? match.minute : 0;
    const p = computeProbabilities(sim.lambdaHome, sim.lambdaAway, match.score, minute);
    const suspended = sim.suspendTicks > 0;

    // Odds anteriores, para evoluir de forma estável em vez de recalcular do zero.
    const prev = new Map<string, number>();
    for (const m of match.markets) for (const s of m.selections) prev.set(s.id, s.odds);

    // Odd exibida = evolução suave entre a anterior e o modelo (ver evolve()).
    const ev = (id: string, prob: number) => {
      const model = probToOdds(prob);
      return applyJitter ? this.evolve(prev.get(id), model) : model;
    };

    const idHome = makeSelectionId(match.id, "1x2", "home");
    const idDraw = makeSelectionId(match.id, "1x2", "draw");
    const idAway = makeSelectionId(match.id, "1x2", "away");
    const idOver = makeSelectionId(match.id, "ou25", "over");
    const idUnder = makeSelectionId(match.id, "ou25", "under");
    const idYes = makeSelectionId(match.id, "btts", "yes");
    const idNo = makeSelectionId(match.id, "btts", "no");

    return [
      {
        key: "1x2",
        name: "Resultado Final",
        selections: [
          { id: idHome, label: match.home, odds: ev(idHome, p.home), suspended },
          { id: idDraw, label: "Empate", odds: ev(idDraw, p.draw), suspended },
          { id: idAway, label: match.away, odds: ev(idAway, p.away), suspended },
        ],
      },
      {
        key: "ou25",
        name: "Total de Gols 2.5",
        selections: [
          { id: idOver, label: "Mais 2.5", odds: ev(idOver, p.over25), suspended },
          { id: idUnder, label: "Menos 2.5", odds: ev(idUnder, p.under25), suspended },
        ],
      },
      {
        key: "btts",
        name: "Ambos Marcam",
        selections: [
          { id: idYes, label: "Sim", odds: ev(idYes, p.bttsYes), suspended },
          { id: idNo, label: "Não", odds: ev(idNo, p.bttsNo), suspended },
        ],
      },
    ];
  }

  /**
   * Evolui uma odd de forma realista: na maior parte dos ticks ela fica
   * estável; ocasionalmente faz um micro-movimento em direção ao modelo; e
   * "salta" quando o modelo muda de verdade (gol, tempo) — como numa casa real.
   */
  private evolve(prev: number | undefined, model: number): number {
    if (prev === undefined) return model;
    const rel = Math.abs(model - prev) / prev;
    if (rel > 0.04) return model; // mudança relevante: acompanha o modelo
    if (Math.random() < 0.18) return jitter(prev + (model - prev) * 0.5, 0.01);
    return prev; // estável
  }

  private tick(): void {
    this.tickCount++;
    const now = Date.now();

    for (const match of Array.from(this.matches.values())) {
      const sim = this.sim.get(match.id)!;

      if (match.status === "finished") {
        if (sim.removeAtTick !== null && this.tickCount >= sim.removeAtTick) {
          this.matches.delete(match.id);
          this.sim.delete(match.id);
          this.emit("match_removed", match.id);
        }
        continue;
      }

      if (match.status === "upcoming") {
        if (now >= match.startsAt) {
          match.status = "live";
          match.minute = 0;
          sim.minuteFloat = 0;
        }
        match.markets = this.buildMarkets(match, sim, true);
        this.emit("match_update", match);
        continue;
      }

      // --- ao vivo ---
      if (sim.suspendTicks > 0) sim.suspendTicks--;

      sim.minuteFloat += MIN_PER_TICK * (0.8 + Math.random() * 0.4);
      match.minute = Math.floor(sim.minuteFloat);

      // Gols neste intervalo.
      const minutesThisTick = MIN_PER_TICK;
      const goalsHome = poissonSample(sim.lambdaHome * (minutesThisTick / 90));
      const goalsAway = poissonSample(sim.lambdaAway * (minutesThisTick / 90));
      if (goalsHome > 0 || goalsAway > 0) {
        match.score.home += goalsHome;
        match.score.away += goalsAway;
        sim.suspendTicks = SUSPEND_TICKS; // suspende mercados no gol
      }

      if (match.minute >= 90) {
        match.minute = 90;
        match.status = "finished";
        sim.removeAtTick = this.tickCount + KEEP_FINISHED_TICKS;
        match.markets = this.buildMarkets(match, sim, false);
        this.emit("match_update", match);
        this.emit("match_finished", match);
        continue;
      }

      match.markets = this.buildMarkets(match, sim, true);
      this.emit("match_update", match);
    }

    // Repõe o board para manter o movimento.
    const active = Array.from(this.matches.values()).filter((m) => m.status !== "finished");
    if (active.length < TARGET_MATCHES) {
      this.createMatch("upcoming");
    }
  }
}
