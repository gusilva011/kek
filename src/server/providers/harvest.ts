/**
 * Colhedor de jogos para o MODO DEMONSTRAÇÃO.
 *
 * Faz UMA coleta ampla na API-Football (vários dias + várias páginas de odds),
 * respeitando a cota diária, e grava tudo em data/demo-matches.json — que o
 * DemoEngine prioriza sobre o cache. Assim a vitrine demo fica cheia de jogos
 * reais "congelados", sem gastar cota depois.
 *
 * Uso:  npm run feed:harvest
 *
 * CUSTO: consome a cota de hoje da chave (free tier = 100 req/dia). Roda uma vez;
 * o resultado fica salvo. Confere a cota restante antes e respeita um orçamento.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { Match } from "../../shared/types";
import { fetchApiFootballMatches } from "./apiFootball";
import { fetchOddsApiMatches } from "./theOddsApi";

// O tsx não carrega .env.local sozinho (ao contrário do Next).
try {
  process.loadEnvFile(".env.local");
} catch {
  /* ausente — ok */
}

const BASE = "https://v3.football.api-sports.io";

/** Lê o uso da conta (não conta contra a cota diária). */
async function checkQuota(key: string): Promise<{ used: number; limit: number } | null> {
  try {
    const r: any = await fetch(`${BASE}/status`, { headers: { "x-apisports-key": key } }).then((x) => x.json());
    const reqs = r?.response?.requests;
    if (reqs && typeof reqs.current === "number") {
      return { used: reqs.current, limit: reqs.limit_day ?? 100 };
    }
  } catch {
    /* ignora — seguimos com defaults */
  }
  return null;
}

async function main() {
  const afKey = process.env.APIFOOTBALL_KEY;
  const oddsKey = process.env.ODDS_API_KEY;
  // Por padrão a colheita traz só odds REAIS (futebol + multi-esporte). Passe um
  // número (1º arg) para LIGAR a síntese de odds no futebol até N jogos — vitrine
  // maior, mas com odds geradas onde a API free não fornece.
  const synthTarget = Math.max(0, Math.min(2000, Number(process.argv[2]) || 0));

  const all: Match[] = [];

  // 1) Futebol REAL (API-Football) — odds e mercados reais.
  if (afKey) {
    const q = await checkQuota(afKey);
    let reqBudget = 50;
    if (q) {
      const left = q.limit - q.used;
      console.log(`[harvest] API-Football: ${q.used}/${q.limit} usadas hoje — restam ~${left}.`);
      reqBudget = left < 6 ? 0 : Math.min(left - 3, 60);
    }
    if (reqBudget > 0) {
      const football = await fetchApiFootballMatches(afKey, {
        startDayOffset: -1,
        days: 3,
        maxOddsPages: 8,
        includeFinished: true,
        synthesizeMissing: synthTarget > 0,
        targetMatches: synthTarget || undefined,
        requestBudget: reqBudget,
        throttleMs: 2100,
        log: (m) => console.log(m),
      });
      all.push(...football);
      console.log(`[harvest] futebol: ${football.length} jogos.`);
    } else {
      console.log("[harvest] cota API-Football baixa hoje — pulando futebol nesta colheita.");
    }
  } else {
    console.log("[harvest] APIFOOTBALL_KEY ausente — sem futebol.");
  }

  // 2) Multi-esporte REAL (The Odds API) — NBA, MLB, NFL, tênis, MMA, etc.
  if (oddsKey) {
    const multi = await fetchOddsApiMatches(oddsKey, {
      requestBudget: 60,
      throttleMs: 250,
      withTotals: true,
      log: (m) => console.log(m),
    });
    all.push(...multi);
    console.log(`[harvest] multi-esporte: ${multi.length} jogos.`);
  } else {
    console.log("[harvest] ODDS_API_KEY ausente — sem multi-esporte.");
  }

  if (all.length === 0) {
    console.error("[harvest] nenhum jogo colhido (cota/chaves?). Acervo anterior preservado.");
    process.exit(1);
  }

  // Dedupe por id e grava.
  const matches = Array.from(new Map(all.map((m) => [m.id, m])).values());
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "demo-matches.json"), JSON.stringify(matches, null, 2), "utf8");

  const ligas = new Set(matches.map((m) => m.league)).size;
  const esportes = new Set(matches.map((m) => m.sport)).size;
  console.log(`[harvest] ✅ ${matches.length} jogos · ${ligas} ligas · ${esportes} esportes → data/demo-matches.json`);
  console.log(`[harvest] reinicie o gateway (modo demo) para carregar o novo acervo.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
