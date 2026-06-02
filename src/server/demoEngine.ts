/**
 * Motor de DEMONSTRAÇÃO.
 *
 * Carrega os jogos REAIS já colhidos da API-Football (cache em disco: times,
 * escudos, ligas e odds reais) e os faz "rolar ao vivo" por cima — placar,
 * minuto, odds reagindo a gols, suspensão no gol, finalização e liquidação —
 * SEM nunca chamar a API (cota congelada). É a vitrine para mostrar o site
 * completo e vivo a um cliente: o board fica sempre cheio e em movimento, num
 * ciclo perpétuo (jogos terminam, liquidam e recomeçam).
 *
 * Reaproveita o modelo de odds (Poisson) de `odds.ts`, igual ao
 * SimulationEngine, mas alimentado por jogos reais. Emite os mesmos eventos
 * `match_update` / `match_finished` / `match_removed` que o gateway retransmite
 * — então o cliente não muda. A liquidação (`store.settleMatch`) já é compatível
 * com os IDs de seleção do feed real (`makeSelectionId`).
 *
 * Fonte dos jogos (na ordem): `data/demo-matches.json` (acervo dedicado, colhido
 * sob demanda) → `data/odds-cache.json` (cache do feed real). Assim o modo demo
 * funciona mesmo sem colher nada novo.
 */

import { EventEmitter } from "events";
import type { Match } from "../shared/types";
import { makeSelectionId } from "../shared/ids";
import { computeProbabilities, probToOdds, jitter } from "./odds";
import { loadJson } from "./persist";
import type { OddsSource } from "./realFeed";

const TICK_MS = 2000;
/** Minutos de jogo que passam a cada tick (acelerado para a demo). */
const MIN_PER_TICK = 1.5;
/** Ticks que um mercado fica suspenso após um gol. */
const SUSPEND_TICKS = 2;
/** Ticks que uma partida encerrada fica visível antes de recomeçar o ciclo. */
const KEEP_FINISHED_TICKS = 6;
/** Alvo MÍNIMO de jogos simultâneos ao vivo (promove pré-jogos até atingir). */
const TARGET_LIVE = 22;
/**
 * Teto de jogos simultâneos ao vivo. Com um board grande (centenas de jogos),
 * deixar todos "rolarem" ao mesmo tempo faria centenas de linhas re-renderizarem
 * por segundo no cliente. Limitamos os ao vivo (o resto fica pré-jogo, como num
 * sportsbook real) — o board fica cheio E fluido. Vagas abrem quando um jogo
 * encerra; aí outro entra ao vivo.
 */
const MAX_LIVE = 32;
const DEMO_FILE = "demo-matches.json";
const CACHE_FILE = "odds-cache.json";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Amostra de uma Poisson (Knuth) — número de gols num período. */
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

/**
 * Evolui uma odd de forma realista: estável na maior parte dos ticks, com
 * micro-movimentos ocasionais e saltos quando o modelo muda de verdade (gol).
 */
function evolve(prev: number, model: number): number {
  const rel = Math.abs(model - prev) / prev;
  if (rel > 0.04) return model;
  if (Math.random() < 0.18) return jitter(prev + (model - prev) * 0.5, 0.01);
  return prev;
}

/**
 * Deriva a força ofensiva (gols esperados em 90') de cada time a partir das
 * odds reais de Resultado Final — assim o placar simulado fica coerente com o
 * favoritismo real do jogo.
 */
function lambdasFromMatch(m: Match): { lambdaHome: number; lambdaAway: number } {
  const mk = m.markets.find((k) => k.key === "1x2") ?? m.markets.find((k) => k.key === "ml");
  let pH = 0.4;
  let pD = 0.27;
  let pA = 0.33;
  if (mk) {
    const odd = (suffix: string) => mk.selections.find((s) => s.id.endsWith(`__${suffix}`))?.odds;
    const oh = odd("home");
    const od = odd("draw");
    const oa = odd("away");
    if (oh && oa) {
      const iH = 1 / oh;
      const iD = od ? 1 / od : 0;
      const iA = 1 / oa;
      const sum = iH + iD + iA || 1;
      pH = iH / sum;
      pD = iD / sum;
      pA = iA / sum;
    }
  }
  const sup = pH - pA; // supremacia (-1 a 1)
  const tg = clamp(3.0 - pD * 2.0, 1.9, 3.3); // total de gols esperado
  const shareHome = clamp(0.5 + sup * 0.35, 0.28, 0.72);
  const lambdaHome = clamp(tg * shareHome + 0.12, 0.45, 3.3); // +fator casa
  const lambdaAway = clamp(tg * (1 - shareHome), 0.35, 3.0);
  return { lambdaHome, lambdaAway };
}

interface DemoState {
  lambdaHome: number;
  lambdaAway: number;
  /** Odds reais iniciais (âncora dos mercados não modelados). */
  base: Map<string, number>;
  suspend: number;
  minuteFloat: number;
  /** Quando finished: tick em que o ciclo recomeça. */
  restartAtTick: number | null;
  /** Quando upcoming: tick em que entra ao vivo. */
  kickoffTick: number | null;
}

export class DemoEngine extends EventEmitter implements OddsSource {
  private matches = new Map<string, Match>();
  private state = new Map<string, DemoState>();
  private order: string[] = [];
  private tickCount = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.seedBoard(loadSeed());
    this.timer = setInterval(() => this.tick(), TICK_MS);
    console.log(
      `[demo] ${this.matches.size} jogos reais no board — modo demonstração (ao vivo simulado, cota congelada)`,
    );
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

  getSelection(matchId: string, marketKey: string, selectionId: string) {
    const match = this.matches.get(matchId);
    if (!match) return null;
    const market = match.markets.find((m) => m.key === marketKey);
    if (!market) return null;
    const selection = market.selections.find((s) => s.id === selectionId);
    if (!selection) return null;
    return { match, market, selection };
  }

  /** Os jogos demo já vêm com todos os mercados; nada a carregar sob demanda. */
  loadMarkets(matchId: string): void {
    const m = this.matches.get(matchId);
    if (m) m.marketsLoaded = true;
  }

  /* ---------------------------------------------------------------- */

  private seedBoard(seed: Match[]): void {
    const list = shuffle(seed.filter((m) => m.markets && m.markets.length > 0));
    let liveCount = 0;

    for (const m of list) {
      // Só FUTEBOL recebe o "ao vivo" simulado (placar/minuto/gols via Poisson).
      // Outros esportes (basquete, beisebol, etc.) ficam como PRÉ-JOGO com as
      // odds REAIS da API — simular gol/90' neles seria irreal. Quando o feed
      // live real entrar, cada esporte ganha sua própria animação.
      const sim = m.sport === "football";
      const { lambdaHome, lambdaAway } = lambdasFromMatch(m);
      const base = new Map<string, number>();
      for (const mk of m.markets) for (const s of mk.selections) base.set(s.id, s.odds);

      const st: DemoState = {
        lambdaHome,
        lambdaAway,
        base,
        suspend: 0,
        minuteFloat: 0,
        restartAtTick: null,
        kickoffTick: null,
      };

      if (sim && liveCount < TARGET_LIVE) {
        // Já entra ao vivo, com minuto e placar coerentes.
        const minute = Math.floor(5 + Math.random() * 75);
        st.minuteFloat = minute;
        m.status = "live";
        m.minute = minute;
        m.score = {
          home: poissonSample(lambdaHome * (minute / 90)),
          away: poissonSample(lambdaAway * (minute / 90)),
        };
        liveCount++;
        this.reprice(m, st);
      } else if (sim) {
        // Futebol pré-jogo: entra ao vivo escalonado nos próximos ticks.
        m.status = "upcoming";
        m.minute = 0;
        m.score = { home: 0, away: 0 };
        st.kickoffTick = 8 + Math.floor(Math.random() * 140);
        m.startsAt = Date.now() + st.kickoffTick * TICK_MS;
        this.reprice(m, st);
      } else {
        // Outro esporte: pré-jogo permanente com odds REAIS (sem reprecificar).
        m.status = "upcoming";
        m.minute = 0;
        m.score = { home: 0, away: 0 };
        st.kickoffTick = null;
      }

      this.matches.set(m.id, m);
      this.state.set(m.id, st);
      this.order.push(m.id);
    }
  }

  private tick(): void {
    this.tickCount++;

    // Conta os jogos ao vivo no início do tick — o teto MAX_LIVE é respeitado ao
    // longo de toda a varredura (vagas abrem quando um jogo encerra).
    let liveNow = 0;
    for (const m of this.matches.values()) if (m.status === "live") liveNow++;

    for (const id of this.order) {
      const m = this.matches.get(id);
      if (!m) continue;
      const st = this.state.get(id)!;

      if (m.status === "finished") {
        if (st.restartAtTick !== null && this.tickCount >= st.restartAtTick) {
          this.restart(m, st);
        }
        continue;
      }

      if (m.status === "upcoming") {
        if (st.kickoffTick !== null && this.tickCount >= st.kickoffTick) {
          if (liveNow < MAX_LIVE) {
            m.status = "live";
            m.minute = 0;
            st.minuteFloat = 0;
            st.kickoffTick = null;
            liveNow++;
            this.reprice(m, st);
            this.emit("match_update", m);
          } else {
            // Sem vaga ao vivo: reagenda o pontapé para daqui a pouco.
            st.kickoffTick = this.tickCount + 6 + Math.floor(Math.random() * 24);
          }
        } else if (Math.random() < 0.03) {
          this.breathe(m, st); // odds de pré-jogo "respiram" de leve
          this.emit("match_update", m);
        }
        continue;
      }

      // --- ao vivo ---
      if (st.suspend > 0) st.suspend--;
      st.minuteFloat += MIN_PER_TICK * (0.8 + Math.random() * 0.4);
      m.minute = Math.floor(st.minuteFloat);

      const gh = poissonSample(st.lambdaHome * (MIN_PER_TICK / 90));
      const ga = poissonSample(st.lambdaAway * (MIN_PER_TICK / 90));
      if (gh > 0 || ga > 0) {
        m.score.home += gh;
        m.score.away += ga;
        st.suspend = SUSPEND_TICKS;
      }

      if (m.minute >= 90) {
        m.minute = 90;
        m.status = "finished";
        st.suspend = 0;
        liveNow--; // abre uma vaga ao vivo
        st.restartAtTick = this.tickCount + KEEP_FINISHED_TICKS;
        this.reprice(m, st);
        this.emit("match_update", m);
        this.emit("match_finished", m); // dispara a liquidação no store
        continue;
      }

      this.reprice(m, st);
      this.emit("match_update", m);
    }

    // Mantém o board vivo: promove pré-jogos de FUTEBOL até o mínimo ao vivo.
    if (liveNow < TARGET_LIVE) {
      for (const id of this.order) {
        const m = this.matches.get(id);
        if (m && m.status === "upcoming" && m.sport === "football") {
          this.state.get(id)!.kickoffTick = this.tickCount; // entra no próximo tick
          if (++liveNow >= TARGET_LIVE) break;
        }
      }
    }
  }

  /** Recomeça o ciclo de um jogo encerrado: volta a pré-jogo com odds reais. */
  private restart(m: Match, st: DemoState): void {
    m.status = "upcoming";
    m.minute = 0;
    m.score = { home: 0, away: 0 };
    st.minuteFloat = 0;
    st.suspend = 0;
    st.restartAtTick = null;
    st.kickoffTick = this.tickCount + 10 + Math.floor(Math.random() * 90);
    m.startsAt = Date.now() + (st.kickoffTick - this.tickCount) * TICK_MS;
    for (const mk of m.markets) {
      for (const s of mk.selections) {
        const b = st.base.get(s.id);
        if (b !== undefined) s.odds = b;
        s.suspended = false;
      }
    }
    this.emit("match_update", m);
  }

  /** Recalcula as odds dos mercados modelados; os demais "respiram" ancorados. */
  private reprice(m: Match, st: DemoState): void {
    const minute = m.status === "live" ? m.minute : 0;
    const p = computeProbabilities(st.lambdaHome, st.lambdaAway, m.score, minute);
    const probById = new Map<string, number>([
      [makeSelectionId(m.id, "1x2", "home"), p.home],
      [makeSelectionId(m.id, "1x2", "draw"), p.draw],
      [makeSelectionId(m.id, "1x2", "away"), p.away],
      [makeSelectionId(m.id, "ml", "home"), p.home + p.draw / 2],
      [makeSelectionId(m.id, "ml", "away"), p.away + p.draw / 2],
      [makeSelectionId(m.id, "ou25", "over"), p.over25],
      [makeSelectionId(m.id, "ou25", "under"), p.under25],
      [makeSelectionId(m.id, "btts", "yes"), p.bttsYes],
      [makeSelectionId(m.id, "btts", "no"), p.bttsNo],
    ]);
    const suspended = st.suspend > 0;

    for (const mk of m.markets) {
      for (const s of mk.selections) {
        const prob = probById.get(s.id);
        if (prob !== undefined) {
          s.odds = evolve(s.odds, probToOdds(prob));
        } else if (Math.random() < 0.5) {
          s.odds = jitter(st.base.get(s.id) ?? s.odds, 0.01); // ancorado na odd real
        }
        s.suspended = suspended;
      }
    }
  }

  private breathe(m: Match, st: DemoState): void {
    for (const mk of m.markets) {
      for (const s of mk.selections) {
        s.odds = jitter(st.base.get(s.id) ?? s.odds, 0.012);
      }
    }
  }
}

/** Lê o acervo de jogos reais: arquivo dedicado de demo → cache do feed real. */
function loadSeed(): Match[] {
  const fromDemo = pickMatches(loadJson<unknown>(DEMO_FILE, null));
  if (fromDemo.length > 0) return fromDemo;
  return pickMatches(loadJson<unknown>(CACHE_FILE, null));
}

function pickMatches(raw: unknown): Match[] {
  if (Array.isArray(raw)) return raw as Match[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { matches?: unknown }).matches)) {
    return (raw as { matches: Match[] }).matches;
  }
  return [];
}
