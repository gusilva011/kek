/**
 * Motor de odds REAIS (The Odds API), com a mesma interface do simulador, então
 * o gateway usa um ou outro de forma intercambiável (env ODDS_PROVIDER).
 *
 * Economia de cota:
 *  - Cache em disco (data/odds-cache.json): restarts no dev reusam o cache.
 *  - Refresh lento (15 min por padrão; odds pré-jogo mudam devagar).
 *
 * Limitação desta etapa: o endpoint de odds traz PRÉ-JOGO (sem placar/minuto ao
 * vivo). Logo, o board mostra jogos a começar com odds reais. "Ao vivo" e a
 * liquidação automática exigem o endpoint de scores — próximo passo.
 */

import { EventEmitter } from "events";
import type { Market, Match, Selection } from "../shared/types";
import { loadJson, saveJson } from "./persist";

type FetchMatches = () => Promise<Match[]>;
type LoadEventMarkets = (match: Match) => Promise<Market[]>;

const REFRESH_MS = Number(process.env.ODDS_REFRESH_MS ?? 3 * 60 * 60 * 1000);
const CACHE_FILE = "odds-cache.json";
const MAX_MATCHES = 600;
const ENRICH_TTL = 5 * 60 * 1000;

/** Interface comum a SimulationEngine e RealFeedEngine. */
export interface OddsSource {
  start(): void;
  stop(): void;
  getMatches(): Match[];
  getMatch(id: string): Match | undefined;
  getSelection(
    matchId: string,
    marketKey: string,
    selectionId: string,
  ): { match: Match; market: Market; selection: Selection } | null;
  on(event: string | symbol, listener: (...args: any[]) => void): unknown;
  /** Carrega mercados estendidos de um jogo (detalhe). Opcional. */
  loadMarkets?(matchId: string): void | Promise<void>;
}

interface OddsCache {
  at: number;
  matches: Match[];
}

export class RealFeedEngine extends EventEmitter implements OddsSource {
  private matches = new Map<string, Match>();
  private enrichedAt = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fetchMatches: FetchMatches,
    private loadEventMarkets?: LoadEventMarkets,
  ) {
    super();
  }

  start(): void {
    console.log("[feed] iniciando feed real…");
    void this.refresh(true);
    this.timer = setInterval(() => void this.refresh(false), REFRESH_MS);
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

  /** Carrega os mercados estendidos de um jogo sob demanda (detalhe). */
  async loadMarkets(matchId: string): Promise<void> {
    const match = this.matches.get(matchId);
    if (!match) return;
    // Provedor sem mercados estendidos sob demanda (ex.: API-Football já traz tudo).
    if (!this.loadEventMarkets) {
      match.marketsLoaded = true;
      return;
    }
    const last = this.enrichedAt.get(matchId) ?? 0;
    if (match.marketsLoaded && Date.now() - last < ENRICH_TTL) return; // cache

    try {
      const markets = await this.loadEventMarkets(match);
      if (markets.length > 0) {
        const byKey = new Map(match.markets.map((m) => [m.key, m]));
        for (const m of markets) byKey.set(m.key, m); // novos entram, base atualiza
        match.markets = Array.from(byKey.values());
      }
      match.marketsLoaded = true;
      this.enrichedAt.set(matchId, Date.now());
      this.emit("match_update", match);
    } catch (e) {
      console.error("[feed] loadMarkets:", e);
    }
  }

  private async refresh(useCacheIfFresh: boolean): Promise<void> {
    let list: Match[] | null = null;
    const cache = loadJson<OddsCache | null>(CACHE_FILE, null);

    if (useCacheIfFresh && cache && Date.now() - cache.at < REFRESH_MS) {
      list = cache.matches;
      console.log(`[feed] cache (${list.length} jogos, ${Math.round((Date.now() - cache.at) / 1000)}s atrás)`);
    } else {
      try {
        list = await this.fetchMatches();
        saveJson(CACHE_FILE, { at: Date.now(), matches: list });
      } catch (e) {
        console.error("[feed] erro ao buscar odds:", e);
        if (cache) list = cache.matches;
      }
    }
    if (list) this.apply(list);
  }

  private apply(list: Match[]): void {
    const now = Date.now();
    const upcoming = list
      .filter((m) => m.startsAt > now - 2 * 60 * 60 * 1000)
      .map((m) => ({ ...m, status: "upcoming" as const }))
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, MAX_MATCHES);

    const seen = new Set<string>();
    for (const m of upcoming) {
      seen.add(m.id);
      this.matches.set(m.id, m);
      this.emit("match_update", m);
    }
    for (const id of Array.from(this.matches.keys())) {
      if (!seen.has(id)) {
        this.matches.delete(id);
        this.emit("match_removed", id);
      }
    }
    console.log(`[feed] ${upcoming.length} jogos reais no board`);
  }
}
