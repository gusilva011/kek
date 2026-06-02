/**
 * Tradução de nomes (EN → PT-BR) para exibição.
 *
 * Os feeds (API-Football / The Odds API) trazem nomes em inglês. Traduzimos na
 * CAMADA DE EXIBIÇÃO — os nomes originais seguem para lookups (escudos, apostas,
 * liquidação). Cobrimos países (seleções, que são os nomes mais visíveis) e as
 * ligas/competições em inglês mais comuns. Nomes de clubes (próprios) ficam
 * como estão.
 */

/** Países / seleções: inglês → português. */
const COUNTRY_PT: Record<string, string> = {
  World: "Internacional",
  England: "Inglaterra",
  Scotland: "Escócia",
  Wales: "País de Gales",
  "Northern Ireland": "Irlanda do Norte",
  Ireland: "Irlanda",
  France: "França",
  Spain: "Espanha",
  Germany: "Alemanha",
  Italy: "Itália",
  Portugal: "Portugal",
  Netherlands: "Holanda",
  Belgium: "Bélgica",
  Switzerland: "Suíça",
  Austria: "Áustria",
  Norway: "Noruega",
  Sweden: "Suécia",
  Denmark: "Dinamarca",
  Finland: "Finlândia",
  Iceland: "Islândia",
  Poland: "Polônia",
  Croatia: "Croácia",
  Serbia: "Sérvia",
  Czechia: "Tchéquia",
  "Czech Republic": "Tchéquia",
  Slovakia: "Eslováquia",
  Slovenia: "Eslovênia",
  Hungary: "Hungria",
  Romania: "Romênia",
  Bulgaria: "Bulgária",
  Greece: "Grécia",
  Turkey: "Turquia",
  Türkiye: "Turquia",
  Russia: "Rússia",
  Ukraine: "Ucrânia",
  Georgia: "Geórgia",
  Armenia: "Armênia",
  Azerbaijan: "Azerbaijão",
  Albania: "Albânia",
  "North Macedonia": "Macedônia do Norte",
  "Bosnia & Herzegovina": "Bósnia e Herzegovina",
  "Bosnia and Herzegovina": "Bósnia e Herzegovina",
  Montenegro: "Montenegro",
  Kosovo: "Kosovo",
  Luxembourg: "Luxemburgo",
  Cyprus: "Chipre",
  Malta: "Malta",
  Estonia: "Estônia",
  Latvia: "Letônia",
  Lithuania: "Lituânia",
  Belarus: "Bielorrússia",
  Moldova: "Moldávia",
  Kazakhstan: "Cazaquistão",
  Uzbekistan: "Uzbequistão",
  // Américas
  Brazil: "Brasil",
  Argentina: "Argentina",
  Uruguay: "Uruguai",
  Paraguay: "Paraguai",
  Chile: "Chile",
  Peru: "Peru",
  Colombia: "Colômbia",
  Ecuador: "Equador",
  Bolivia: "Bolívia",
  Venezuela: "Venezuela",
  "United States": "Estados Unidos",
  USA: "Estados Unidos",
  Mexico: "México",
  Canada: "Canadá",
  "Costa Rica": "Costa Rica",
  Panama: "Panamá",
  Honduras: "Honduras",
  Guatemala: "Guatemala",
  Jamaica: "Jamaica",
  Haiti: "Haiti",
  "Trinidad & Tobago": "Trinidad e Tobago",
  // África
  Morocco: "Marrocos",
  Algeria: "Argélia",
  Tunisia: "Tunísia",
  Egypt: "Egito",
  Nigeria: "Nigéria",
  Ghana: "Gana",
  Senegal: "Senegal",
  Cameroon: "Camarões",
  "Ivory Coast": "Costa do Marfim",
  "Côte d'Ivoire": "Costa do Marfim",
  Mali: "Mali",
  "Burkina Faso": "Burkina Faso",
  "South Africa": "África do Sul",
  Madagascar: "Madagáscar",
  "Cape Verde": "Cabo Verde",
  "DR Congo": "RD Congo",
  Congo: "Congo",
  Angola: "Angola",
  Mozambique: "Moçambique",
  Zambia: "Zâmbia",
  Zimbabwe: "Zimbábue",
  Kenya: "Quênia",
  Uganda: "Uganda",
  Tanzania: "Tanzânia",
  Ethiopia: "Etiópia",
  Guinea: "Guiné",
  Gabon: "Gabão",
  "Equatorial Guinea": "Guiné Equatorial",
  Libya: "Líbia",
  Mauritania: "Mauritânia",
  Benin: "Benim",
  Togo: "Togo",
  Namibia: "Namíbia",
  Sudan: "Sudão",
  // Ásia / Oceania
  Japan: "Japão",
  "South Korea": "Coreia do Sul",
  "Korea Republic": "Coreia do Sul",
  "North Korea": "Coreia do Norte",
  China: "China",
  "China PR": "China",
  "Saudi Arabia": "Arábia Saudita",
  Iran: "Irã",
  Iraq: "Iraque",
  Qatar: "Catar",
  "United Arab Emirates": "Emirados Árabes",
  Jordan: "Jordânia",
  Lebanon: "Líbano",
  Syria: "Síria",
  Oman: "Omã",
  Kuwait: "Kuwait",
  Bahrain: "Bahrein",
  Yemen: "Iêmen",
  India: "Índia",
  Indonesia: "Indonésia",
  Thailand: "Tailândia",
  Vietnam: "Vietnã",
  Malaysia: "Malásia",
  Singapore: "Singapura",
  Philippines: "Filipinas",
  Myanmar: "Mianmar",
  Australia: "Austrália",
  "New Zealand": "Nova Zelândia",
  Israel: "Israel",
};

/** Ligas / competições em inglês comuns → português. */
const LEAGUE_PT: Record<string, string> = {
  Friendlies: "Amistosos",
  "Friendlies Clubs": "Amistosos de Clubes",
  "Friendlies Women": "Amistosos (Fem.)",
  "Club Friendlies": "Amistosos de Clubes",
  "Reserve League": "Liga de Reservas",
  "Premier League": "Premier League",
  Championship: "Championship (ING)",
  "League One": "League One (ING)",
  "League Two": "League Two (ING)",
  "Svenska Cupen": "Copa da Suécia",
  "Ettan - Norra": "Ettan – Norte (SUE)",
  "Ettan - Södra": "Ettan – Sul (SUE)",
  "Superettan - Sweden": "Superettan (SUE)",
  Allsvenskan: "Allsvenskan",
  "1. Division": "1ª Divisão",
  "2. Division": "2ª Divisão",
  "3. Division": "3ª Divisão",
  "Serie A": "Serie A (ITA)",
  "Serie B": "Série B",
  "Serie C": "Serie C (ITA)",
  "Serie D": "Serie D (ITA)",
  "USL League Two": "USL League Two (EUA)",
  "USL League One": "USL League One (EUA)",
  "USL Championship": "USL Championship (EUA)",
  "Major League Soccer": "MLS",
  "Primera B": "Primeira B",
  "Primera B Metropolitana": "Primeira B Metropolitana",
  "Primera C": "Primeira C",
  "Primera División": "Primeira Divisão",
  "Primera Division": "Primeira Divisão",
  "Segunda División": "Segunda Divisão",
  "Reserve League - 1": "Liga de Reservas",
  "Première Division": "Primeira Divisão",
  "Premiere Division": "Primeira Divisão",
  "Queensland NPL": "NPL Queensland (AUS)",
  "Victoria NPL": "NPL Victoria (AUS)",
  "Capital Territory NPL": "NPL Capital (AUS)",
  "NPL": "NPL (AUS)",
  "Test Matches": "Test (Críquete)",
  "One Day Internationals": "ODI (Críquete)",
  "T20 Blast": "T20 Blast (Críquete)",
  Boxing: "Boxe",
  "Persha Liga": "Primeira Liga (UCR)",
  "Azadegan League": "Liga Azadegan (IRA)",
  "Botola Pro": "Botola Pro (MAR)",
  "Division di Honor": "Divisão de Honra",
  "Esiliiga A": "Esiliiga A (EST)",
  "Esiliiga B": "Esiliiga B (EST)",
  Ykkönen: "Ykkönen (FIN)",
  "Regionalliga - Mitte": "Regionalliga – Centro (ALE)",
  "Regionalliga - Ost": "Regionalliga – Leste (ALE)",
  "Regionalliga - Nord": "Regionalliga – Norte (ALE)",
  "Regionalliga - Süd": "Regionalliga – Sul (ALE)",
  "Tournoi Maurice Revello": "Torneio Maurice Revello",
  "Catarinense U20": "Catarinense Sub-20",
};

/** Nome de exibição do time (traduz países; clubes ficam iguais). */
export function ptTeam(name: string): string {
  return COUNTRY_PT[name] ?? name;
}

/** Nome de exibição da liga/competição. */
export function ptLeague(name: string): string {
  return LEAGUE_PT[name] ?? name;
}

/** Nome de exibição de país (países; mantém o resto). */
export function ptCountry(name: string | undefined): string | undefined {
  if (!name) return name;
  return COUNTRY_PT[name] ?? name;
}

/** Rótulo de confronto "A x B" → traduz cada lado. */
export function ptMatchLabel(label: string): string {
  if (!label.includes(" x ")) return label;
  return label
    .split(" x ")
    .map((s) => ptTeam(s.trim()))
    .join(" x ");
}

/* ------------------------------------------------------------------ */
/* Mercados (nomes) e seleções (valores) — usado nos normalizadores e   */
/* como rede de segurança no display.                                   */
/* ------------------------------------------------------------------ */

/** Nomes de mercado (tipos de aposta) inglês → português. */
const MARKET_PT: Record<string, string> = {
  "Match Winner": "Resultado Final",
  "Home/Away": "Vencedor (sem empate)",
  "Second Half Winner": "Vencedor 2º Tempo",
  "First Half Winner": "Vencedor 1º Tempo",
  "Goals Over/Under": "Total de Gols",
  "Over/Under": "Total",
  "Goals Over/Under First Half": "Total de Gols (1º Tempo)",
  "Goals Over/Under Second Half": "Total de Gols (2º Tempo)",
  "Both Teams Score": "Ambos Marcam",
  "Both Teams To Score": "Ambos Marcam",
  "Both Teams Score - First Half": "Ambos Marcam (1º Tempo)",
  "Both Teams To Score - First Half": "Ambos Marcam (1º Tempo)",
  "Both Teams Score - Second Half": "Ambos Marcam (2º Tempo)",
  "Double Chance": "Dupla Chance",
  "Double Chance - First Half": "Dupla Chance (1º Tempo)",
  "First Half Double Chance": "Dupla Chance (1º Tempo)",
  "HT/FT Double": "Intervalo / Final",
  "Half Time/Full Time": "Intervalo / Final",
  "Exact Score": "Placar Exato",
  "Correct Score": "Placar Exato",
  "Correct Score - First Half": "Placar Exato (1º Tempo)",
  "Highest Scoring Half": "Tempo com Mais Gols",
  "Odd/Even": "Par / Ímpar",
  "Goals Odd/Even": "Total Par / Ímpar",
  "Total - Home": "Total do Mandante",
  "Total - Away": "Total do Visitante",
  "Team Total - Home": "Total do Mandante",
  "Team Total - Away": "Total do Visitante",
  "Asian Handicap": "Handicap Asiático",
  "Handicap Result": "Resultado com Handicap",
  "Goal Line": "Linha de Gols",
  "Win to Nil - Home": "Mandante Vence sem Sofrer",
  "Win to Nil - Away": "Visitante Vence sem Sofrer",
  "Win to Nil": "Vence sem Sofrer Gol",
  "Clean Sheet - Home": "Mandante Não Sofre Gol",
  "Clean Sheet - Away": "Visitante Não Sofre Gol",
  "Result/Total Goals": "Resultado / Total de Gols",
  "Results/Both Teams Score": "Resultado / Ambos Marcam",
  "Corners Over Under": "Total de Escanteios",
  "Corners 1x2": "Escanteios (1X2)",
  "Cards Over/Under": "Total de Cartões",
  "Total Corners (3 way)": "Total de Escanteios",
  "Team To Score First": "Time a Marcar Primeiro",
  "Team To Score Last": "Time a Marcar por Último",
  "To Score in Both Halves - Home": "Mandante Marca nos 2 Tempos",
  "To Score in Both Halves - Away": "Visitante Marca nos 2 Tempos",
  "First Half Winner ": "Vencedor 1º Tempo",
  "Anytime Goal Scorer": "Marca a Qualquer Momento",
};

export function ptMarketName(name: string): string {
  return MARKET_PT[name.trim()] ?? name.trim();
}

/** Traduz uma palavra de resultado (sem times). */
const WORD_PT: Record<string, string> = {
  Yes: "Sim",
  No: "Não",
  Draw: "Empate",
  Odd: "Ímpar",
  Even: "Par",
  Home: "Casa",
  Away: "Fora",
  "1X": "Casa ou Empate",
  "12": "Casa ou Fora",
  X2: "Empate ou Fora",
  Exactly: "Exatamente",
};

/**
 * Traduz o rótulo de uma seleção (valor de aposta). Conhece Home/Away (vira o
 * nome do time), Over/Under → Mais/Menos, Yes/No → Sim/Não, combinações HT/FT,
 * etc. O que não reconhece volta como veio (placares "2:1" etc.).
 */
export function ptValue(value: string, home?: string, away?: string): string {
  const v = value.trim();
  if (home && (v === "Home" || v === home)) return ptTeam(home);
  if (away && (v === "Away" || v === away)) return ptTeam(away);
  if (WORD_PT[v]) return WORD_PT[v];
  let m = /^Over\s+(.+)$/i.exec(v);
  if (m) return `Mais ${m[1]}`;
  m = /^Under\s+(.+)$/i.exec(v);
  if (m) return `Menos ${m[1]}`;
  // Combinações HT/FT e similares ("Home/Draw", "Draw/Away"…)
  if (v.includes("/")) {
    return v
      .split("/")
      .map((p) => {
        const t = p.trim();
        if (home && (t === "Home" || t === home)) return "Casa";
        if (away && (t === "Away" || t === away)) return "Fora";
        return WORD_PT[t] ?? t;
      })
      .join(" / ");
  }
  return v;
}
