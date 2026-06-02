import type { MarketKey, Market } from "@/shared/types";
import type { IconName } from "@/components/ui/Icon";

/** Esportes (chave interna → rótulo pt + ícone). */
export const SPORT_GROUPS: Record<string, { label: string; icon: IconName }> = {
  football: { label: "Futebol", icon: "football" },
  basketball: { label: "Basquete", icon: "basketball" },
  tennis: { label: "Tênis", icon: "tennis" },
  mma: { label: "MMA / UFC", icon: "mma" },
  boxing: { label: "Boxe", icon: "mma" },
  baseball: { label: "Beisebol", icon: "baseball" },
  icehockey: { label: "Hóquei", icon: "icehockey" },
  americanfootball: { label: "Fut. Americano", icon: "americanfootball" },
  cricket: { label: "Críquete", icon: "trophy" },
  rugby: { label: "Rugby", icon: "trophy" },
  aussierules: { label: "Aussie Rules", icon: "trophy" },
  handball: { label: "Handebol", icon: "trophy" },
  lacrosse: { label: "Lacrosse", icon: "trophy" },
  volleyball: { label: "Vôlei", icon: "volleyball" },
  esports: { label: "eSports", icon: "esports" },
};

export function sportMeta(sport: string): { label: string; icon: IconName } {
  return SPORT_GROUPS[sport] ?? { label: sport, icon: "trophy" };
}

export interface LeagueMeta {
  code: string;
  country: string;
  short: string;
}

// Códigos no formato flagcdn (ISO minúsculo; "wc"/"cont" = selo de troféu).
const LEAGUE_META: Record<string, LeagueMeta> = {
  "Brasileirão Série A": { code: "br", country: "Brasil", short: "Brasileirão" },
  "Brasileirão Série B": { code: "br", country: "Brasil", short: "Série B" },
  "Premier League": { code: "gb-eng", country: "Inglaterra", short: "Premier League" },
  "La Liga": { code: "es", country: "Espanha", short: "La Liga" },
  "La Liga 2 (Espanha)": { code: "es", country: "Espanha", short: "La Liga 2" },
  "Serie A (ITA)": { code: "it", country: "Itália", short: "Serie A" },
  Bundesliga: { code: "de", country: "Alemanha", short: "Bundesliga" },
  "Ligue 1": { code: "fr", country: "França", short: "Ligue 1" },
  "Copa do Mundo": { code: "wc", country: "FIFA", short: "Copa do Mundo" },
  "Champions League": { code: "cont", country: "UEFA", short: "Champions League" },
  Libertadores: { code: "cont", country: "CONMEBOL", short: "Libertadores" },
  "Sul-Americana": { code: "cont", country: "CONMEBOL", short: "Sul-Americana" },
  "J-League": { code: "jp", country: "Japão", short: "J-League" },
  Allsvenskan: { code: "se", country: "Suécia", short: "Allsvenskan" },
  "Primera División (Chile)": { code: "cl", country: "Chile", short: "Primera División" },
  "Super League (China)": { code: "cn", country: "China", short: "Super League" },
  "Eliteserien (Noruega)": { code: "no", country: "Noruega", short: "Eliteserien" },
  "Superettan - Sweden": { code: "se", country: "Suécia", short: "Superettan" },
  // Multi-esporte (The Odds API)
  NBA: { code: "us", country: "EUA", short: "NBA" },
  WNBA: { code: "us", country: "EUA", short: "WNBA" },
  MLB: { code: "us", country: "EUA", short: "MLB" },
  MiLB: { code: "us", country: "EUA", short: "MiLB" },
  KBO: { code: "kr", country: "Coreia do Sul", short: "KBO" },
  NPB: { code: "jp", country: "Japão", short: "NPB" },
  NFL: { code: "us", country: "EUA", short: "NFL" },
  "NFL Preseason": { code: "us", country: "EUA", short: "NFL Pré-temporada" },
  NCAAF: { code: "us", country: "EUA", short: "NCAAF" },
  UFL: { code: "us", country: "EUA", short: "UFL" },
  CFL: { code: "ca", country: "Canadá", short: "CFL" },
  NHL: { code: "us", country: "América do Norte", short: "NHL" },
  AHL: { code: "us", country: "EUA", short: "AHL" },
  AFL: { code: "au", country: "Austrália", short: "AFL" },
  NRL: { code: "au", country: "Austrália", short: "NRL" },
  PLL: { code: "us", country: "EUA", short: "PLL" },
  "Handball-Bundesliga": { code: "de", country: "Alemanha", short: "Handball Bundesliga" },
  "T20 Blast": { code: "gb-eng", country: "Inglaterra", short: "T20 Blast" },
  "ATP French Open": { code: "fr", country: "Roland Garros", short: "Roland Garros (ATP)" },
  "WTA French Open": { code: "fr", country: "Roland Garros", short: "Roland Garros (WTA)" },
};

export function leagueMeta(name: string): LeagueMeta {
  return LEAGUE_META[name] ?? { code: "", country: "", short: name };
}

/** Relevância das ligas (menor = aparece primeiro). Nomes pt + nomes da API-Football. */
const LEAGUE_PRIORITY: Record<string, number> = {
  "Copa do Mundo": 1,
  "FIFA World Cup": 1,
  "Champions League": 2,
  "UEFA Champions League": 2,
  Libertadores: 3,
  "CONMEBOL Libertadores": 3,
  "Premier League": 4,
  "La Liga": 5,
  "Serie A (ITA)": 6,
  "Serie A": 6,
  Bundesliga: 7,
  "Ligue 1": 8,
  "Brasileirão Série A": 9,
  "Sul-Americana": 11,
  "CONMEBOL Sudamericana": 11,
  Friendlies: 12,
  "Friendlies Clubs": 13,
  "Brasileirão Série B": 14,
  "Serie B": 14,
  MLS: 16,
  "Primera División (Chile)": 22,
  "J-League": 24,
  "La Liga 2 (Espanha)": 25,
  "Super League (China)": 27,
  Allsvenskan: 28,
  "Eliteserien (Noruega)": 29,
};
export function leaguePriority(name: string): number {
  return LEAGUE_PRIORITY[name] ?? 50;
}

/** Ordem dos esportes na navegação (menor = primeiro). */
const SPORT_PRIORITY: Record<string, number> = {
  football: 1,
  basketball: 2,
  tennis: 3,
  mma: 4,
  americanfootball: 5,
  baseball: 6,
  icehockey: 7,
  boxing: 8,
  cricket: 9,
  rugby: 10,
  handball: 11,
  aussierules: 12,
  volleyball: 13,
  esports: 14,
};
export function sportPriority(sport: string): number {
  return SPORT_PRIORITY[sport] ?? 50;
}

/** Mercados mostrados como colunas no board (só futebol; o resto usa o vencedor). */
export const MARKET_TABS: { key: MarketKey; title: string }[] = [
  { key: "1x2", title: "Resultado Final" },
  { key: "ou25", title: "Total 2.5" },
];

/** Rótulos curtos das colunas, derivados do mercado realmente exibido. */
export function columnLabels(market: Market): string[] {
  if (market.key === "1x2") return ["1", "X", "2"];
  if (market.key === "ml") return ["1", "2"];
  if (market.key === "btts") return ["Sim", "Não"];
  if (market.key.startsWith("ou")) return ["Mais", "Menos"];
  return market.selections.map((_, i) => ["1", "X", "2"][i] ?? String(i + 1));
}
