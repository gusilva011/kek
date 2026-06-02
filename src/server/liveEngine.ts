/**
 * Motor de AO VIVO REAL.
 *
 * Carrega o acervo de jogos (cache em disco) como PRÉ-JOGO e, por cima, faz
 * polling do endpoint REAL da API-Football (`/fixtures?live=all`) — placar,
 * minuto e status de verdade, dos jogos que estão acontecendo AGORA. Os jogos
 * realmente ao vivo passam a "live" com os dados reais; quando encerram (FT), são
 * liquidados. As odds ao vivo são precificadas a partir do placar/minuto real
 * (`liveMarkets`, modelo de Poisson) — o plano grátis não traz odds ao vivo;
 * troque por odds reais ao assinar o plano pago.
 *
 * Custo: 1 requisição por ciclo (cobre o mundo todo). O intervalo é
 * configurável em `LIVE_POLL_MS` (default 60s). Free tier = 100 req/dia ⇒ ~100
 * min de live por dia; para sempre-ligado, use o plano pago.
 *
 * Emite os mesmos eventos do DemoEngine (`match_update`/`match_finished`/
 * `match_removed`), então o gateway e o cliente não mudam.
 */

import { EventEmitter } from "events";
import type { Match } from "../shared/types";
import { liveMarkets } from "./providers/synthOdds";
import { fetchLiveFixtures, type LiveFixture } from "./providers/apiFootball";
import { loadJson } from "./persist";
import type { OddsSource } from "./realFeed";

const POLL_MS = Math.max(20000, Number(process.env.LIVE_POLL_MS) || 60000);
const DEMO_FILE = "demo-matches.json";
const CACHE_FILE = "odds-cache.json";
/** Ticks de exibição de um jogo encerrado antes de remover do board. */
const KEEP_FINISHED_MS = 5 * 60 * 1000;

export class LiveEngine extends EventEmitter implements OddsSource {
  private matches = new Map<string, Match>();
  private liveIds = new Set<string>();
  private finishedAt = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private apiKey: string) {
    super();
  }

  start(): void {
    if (this.timer) return;
    this.seedBoard(loadSeed());
    console.log(
      `[live] ${this.matches.size} jogos no board (pré-jogo) — buscando os REALMENTE ao vivo a cada ${Math.round(
        POLL_MS / 1000,
      )}s`,
    );
    void this.poll(); // imediato
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    this.cleanupTimer = setInterval(() => this.cleanupFinished(), 60000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.timer = null;
    this.cleanupTimer = null;
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

  /** Os jogos já trazem todos os mercados; nada a carregar sob demanda. */
  loadMarkets(matchId: string): void {
    const m = this.matches.get(matchId);
    if (m) m.marketsLoaded = true;
  }

  /* ---------------------------------------------------------------- */

  private seedBoard(seed: Match[]): void {
    for (const m of seed) {
      if (!m.markets || m.markets.length === 0) continue;
      m.status = "upcoming";
      m.minute = 0;
      m.score = { home: 0, away: 0 };
      this.matches.set(m.id, m);
    }
  }

  private async poll(): Promise<void> {
    let res;
    try {
      res = await fetchLiveFixtures(this.apiKey);
    } catch (e) {
      console.error("[live] falha no polling:", (e as Error).message);
      return;
    }
    // Cota esgotada / erro: NÃO varre os jogos como encerrados — congela o
    // último estado ao vivo (degradação suave; volta a atualizar amanhã).
    if (res.hardLimit) {
      console.error("[live] cota da API esgotada — mantendo o último estado ao vivo (sem novas atualizações hoje).");
      return;
    }

    const { fixtures, remainingDay } = res;
    const nowLive = new Set<string>();

    for (const f of fixtures) {
      if (f.finished) {
        this.settleIfLive(f);
        continue;
      }
      nowLive.add(f.id);
      this.applyLive(f);
    }

    // Jogos que estavam ao vivo e sumiram da lista → encerraram.
    for (const id of this.liveIds) {
      if (!nowLive.has(id)) this.finishById(id);
    }
    this.liveIds = nowLive;

    console.log(
      `[live] ${nowLive.size} jogos ao vivo agora${remainingDay !== null ? ` · cota API restante ~${remainingDay}` : ""}`,
    );
  }

  /** Atualiza (ou adiciona) um jogo realmente ao vivo com dados + odds reais do estado. */
  private applyLive(f: LiveFixture): void {
    const markets = liveMarkets(f.id, f.home, f.away, f.score, f.minute);
    const existing = this.matches.get(f.id);
    if (existing) {
      existing.status = "live";
      existing.minute = f.minute;
      existing.score = f.score;
      existing.markets = markets;
      existing.marketsLoaded = true;
      this.emit("match_update", existing);
      return;
    }
    const m: Match = {
      id: f.id,
      sport: "football",
      league: f.league,
      home: f.home,
      away: f.away,
      status: "live",
      startsAt: f.startsAt,
      minute: f.minute,
      score: f.score,
      markets,
      marketsLoaded: true,
      homeLogo: f.homeLogo,
      awayLogo: f.awayLogo,
      leagueLogo: f.leagueLogo,
      leagueFlag: f.leagueFlag,
      country: f.country,
    };
    this.matches.set(m.id, m);
    this.emit("match_update", m);
  }

  /** Liquida um jogo que apareceu já encerrado (FT) na lista. */
  private settleIfLive(f: LiveFixture): void {
    const m = this.matches.get(f.id);
    if (!m || m.status === "finished") return;
    m.status = "finished";
    m.minute = f.minute || 90;
    m.score = f.score;
    this.finishedAt.set(m.id, Date.now());
    this.liveIds.delete(m.id);
    this.emit("match_update", m);
    this.emit("match_finished", m);
  }

  private finishById(id: string): void {
    const m = this.matches.get(id);
    if (!m || m.status === "finished") return;
    m.status = "finished";
    this.finishedAt.set(id, Date.now());
    this.emit("match_update", m);
    this.emit("match_finished", m);
  }

  /** Remove do board os jogos encerrados há um tempo (mantém o board limpo). */
  private cleanupFinished(): void {
    const now = Date.now();
    for (const [id, at] of this.finishedAt) {
      if (now - at >= KEEP_FINISHED_MS) {
        this.matches.delete(id);
        this.finishedAt.delete(id);
        this.emit("match_removed", id);
      }
    }
  }
}

/** Lê o acervo de jogos: arquivo de demo → cache do feed real. */
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
