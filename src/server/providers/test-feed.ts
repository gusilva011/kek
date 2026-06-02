/**
 * Teste do fornecedor de odds real (The Odds API).
 *
 * Uso:
 *   1. Crie uma chave grátis em https://the-odds-api.com (500 req/mês).
 *   2. Coloque em .env.local:  ODDS_API_KEY=suachave
 *   3. Rode:  npm run feed:test
 *
 * Ele busca jogos reais e imprime no formato normalizado da plataforma —
 * provando que a integração funciona antes de ligá-la no gateway ao vivo.
 */

import { fetchOddsApiMatches } from "./theOddsApi";

// Carrega .env.local sem dependências (Node 20.12+ / 24).
try {
  process.loadEnvFile(".env.local");
} catch {
  /* arquivo ausente — ok */
}

async function main() {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    console.error("Defina ODDS_API_KEY no .env.local (crie a chave grátis em the-odds-api.com).");
    process.exit(1);
  }
  console.log("Buscando odds reais no The Odds API…\n");
  const matches = await fetchOddsApiMatches(key);
  console.log(`\n${matches.length} partidas normalizadas:\n`);
  for (const m of matches.slice(0, 10)) {
    const o1x2 = m.markets.find((mk) => mk.key === "1x2");
    const odds = o1x2?.selections.map((s) => `${s.label} ${s.odds}`).join("  |  ");
    console.log(`• [${m.league}] ${m.home} x ${m.away} (${m.status})`);
    if (odds) console.log(`    ${odds}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
