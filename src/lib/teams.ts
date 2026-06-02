/**
 * Cores reais (curadas) dos times do nosso conjunto demo. Em produção, logo e
 * cores vêm do fornecedor de dados (Sportradar/Genius/etc.). Times fora do mapa
 * caem numa paleta determinística.
 */

export const TEAM_COLORS: Record<string, string> = {
  // Brasileirão
  Flamengo: "#d8261c",
  Palmeiras: "#127a40",
  Botafogo: "#2b2f36",
  "Atlético-MG": "#22262b",
  "São Paulo": "#c4202a",
  Corinthians: "#3a3f46",
  Grêmio: "#1f6fb2",
  Internacional: "#c0392b",
  Fluminense: "#7c2d4a",
  Cruzeiro: "#1f4e9b",
  // Premier League
  "Manchester City": "#3aa0e3",
  Arsenal: "#e1372b",
  Liverpool: "#cc1432",
  "Manchester United": "#d8302a",
  Chelsea: "#1f56b0",
  Tottenham: "#27306b",
  Newcastle: "#2c2f36",
  "Aston Villa": "#7a1736",
  // La Liga
  "Real Madrid": "#3251a8",
  Barcelona: "#1f5aa6",
  "Atlético de Madrid": "#c9342a",
  "Athletic Bilbao": "#e23631",
  "Real Sociedad": "#1f4aa0",
  Villarreal: "#f2c94c",
  "Real Betis": "#0e9450",
  Sevilla: "#cf2233",
  // Serie A
  "Inter de Milão": "#1f3aa0",
  Napoli: "#1f9fd6",
  Juventus: "#2b2f36",
  Milan: "#e23232",
  Atalanta: "#2566b0",
  Roma: "#9a2433",
  Lazio: "#5ab6e6",
  Fiorentina: "#5a2c86",
  // Seleções (Copa do Mundo) — nomes em inglês como vêm do feed
  Brazil: "#f7d017",
  Argentina: "#71a9d8",
  Germany: "#2b2f36",
  France: "#1f3b8c",
  Spain: "#c30b1e",
  England: "#d62828",
  Portugal: "#0a6b3b",
  Netherlands: "#f36c21",
  Mexico: "#0a7a3b",
  USA: "#2a3b8f",
  Japan: "#b81d2e",
  Morocco: "#b81d2e",
  "South Korea": "#2a4b9b",
  Canada: "#d52b1e",
  Australia: "#f7c100",
  Switzerland: "#d52b1e",
  Croatia: "#c1121f",
  Belgium: "#c8102e",
  Uruguay: "#5aa6e0",
  Colombia: "#f5d000",
  Paraguay: "#c1272d",
  Qatar: "#8a1538",
  Turkey: "#e30a17",
  Scotland: "#2a4b9b",
  "South Africa": "#007749",
  "Czech Republic": "#11457e",
  "Bosnia & Herzegovina": "#1f3b8c",
  "Curaçao": "#1f5aa6",
  Haiti: "#1f3b8c",
};

/** Paleta de fallback (tons médios, bom contraste com texto branco). */
const PALETTE = [
  "#3b82a6",
  "#a64b8e",
  "#4b7a3b",
  "#a6743b",
  "#5b53a6",
  "#a63b4b",
  "#3ba68e",
  "#7a3ba6",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function teamColor(name: string): string {
  return TEAM_COLORS[name] ?? PALETTE[hashString(name) % PALETTE.length];
}

/**
 * Seleções nacionais → código de país (flagcdn). Quando o time é uma seleção,
 * o escudo vira a bandeira real do país. Clubes usam monograma.
 */
const NATION_CODES: Record<string, string> = {
  Brazil: "br",
  Argentina: "ar",
  Uruguay: "uy",
  Colombia: "co",
  Paraguay: "py",
  Chile: "cl",
  Mexico: "mx",
  USA: "us",
  Canada: "ca",
  "Costa Rica": "cr",
  Germany: "de",
  France: "fr",
  Spain: "es",
  England: "gb-eng",
  Scotland: "gb-sct",
  Wales: "gb-wls",
  Portugal: "pt",
  Netherlands: "nl",
  Belgium: "be",
  Italy: "it",
  Croatia: "hr",
  Switzerland: "ch",
  "Czech Republic": "cz",
  "Bosnia & Herzegovina": "ba",
  Turkey: "tr",
  Norway: "no",
  Sweden: "se",
  Denmark: "dk",
  Poland: "pl",
  Japan: "jp",
  "South Korea": "kr",
  Australia: "au",
  Qatar: "qa",
  "South Africa": "za",
  Morocco: "ma",
  Senegal: "sn",
  Nigeria: "ng",
  Ghana: "gh",
  Cameroon: "cm",
  "Ivory Coast": "ci",
  Haiti: "ht",
  "Curaçao": "cw",
  Curacao: "cw",
  Ecuador: "ec",
  Peru: "pe",
};

export function teamFlagCode(name: string): string | null {
  return NATION_CODES[name] ?? null;
}
