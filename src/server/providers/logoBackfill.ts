/**
 * Backfill de ESCUDOS (times) e FOTOS (atletas) no acervo demo.
 *
 * Resolve, via TheSportsDB (gratuito), o logo de cada clube e a foto de cada
 * atleta dos jogos em `data/demo-matches.json` e grava nos campos
 * `homeLogo`/`awayLogo`. Assim o board mostra o símbolo REAL de quase todos os
 * competidores (futebol, NBA/NFL/MLB, MMA, tênis, etc.) — e o cliente só carrega
 * a imagem do CDN, sem bater no endpoint de busca (que rate-limita e fazia os
 * símbolos sumirem). Seleções nacionais são puladas (usam bandeira).
 *
 * - Idempotente e RETOMÁVEL: cacheia cada busca em `data/logo-cache.json`
 *   (url achada, ou "" = busca OK mas sem resultado). Erros/rate-limit NÃO são
 *   cacheados — rodar de novo continua de onde parou.
 * - Não sobrescreve um logo que já veio do provedor (ex.: API-Football).
 * - Filtra o resultado por ESPORTE (evita o escudo errado de um xará).
 * - Respeita o rate-limit da chave grátis: ritmo lento + backoff no 429.
 *
 * Uso:  npm run feed:logos   (rode quantas vezes precisar; continua)
 * Depois: reinicie o gateway para recarregar o acervo.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Match } from "../../shared/types";
import { teamFlagCode } from "../../lib/teams";

const DATA_DIR = join(process.cwd(), "data");
const MATCHES_FILE = join(DATA_DIR, "demo-matches.json");
const CACHE_FILE = join(DATA_DIR, "logo-cache.json");
const TSDB = "https://www.thesportsdb.com/api/v1/json/3";

/** Ritmo entre requisições (ms). A chave grátis rate-limita; vá devagar. */
const PACE_MS = Number(process.env.LOGO_PACE_MS) || 1600;
/** Tentativas com backoff ao tomar 429 antes de desistir desta rodada. */
const MAX_429 = 6;

/** Esportes individuais → busca FOTO de atleta, não escudo de time. */
const PLAYER_SPORTS = new Set(["tennis", "mma", "boxing"]);

/** Nosso esporte → strSport do TheSportsDB (para filtrar resultados certos). */
const SPORT_TSDB: Record<string, string> = {
  football: "Soccer",
  basketball: "Basketball",
  baseball: "Baseball",
  americanfootball: "American Football",
  icehockey: "Ice Hockey",
  rugby: "Rugby",
  cricket: "Cricket",
  aussierules: "Australian Football",
  handball: "Handball",
  lacrosse: "Lacrosse",
  tennis: "Tennis",
  mma: "Fighting",
  boxing: "Fighting",
};

/** Correções de nome onde a busca do TheSportsDB erra. */
const TEAM_ALIASES: Record<string, string> = {
  "Clube de Regatas Brasil": "CRB",
  "Athletic Club (MG)": "Athletic Club Brazil",
  "America Mineiro": "America MG",
  "América Mineiro": "America MG",
  "São Bernardo": "Sao Bernardo FC",
  "Sao Bernardo": "Sao Bernardo FC",
  "Vila Nova": "Vila Nova FC",
  "Operario PR": "Operario Ferroviario",
  "Operário PR": "Operario Ferroviario",
  "Metalurh Zaporizhya": "Metalurh Zaporizhzhia",
};

type Cache = Record<string, string>; // chave → url ("" = buscado, sem resultado)

function loadCache(): Cache {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Cache;
  } catch {
    return {};
  }
}
function saveCache(c: Cache): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2), "utf8");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Lançado quando o rate-limit persiste — main salva o progresso e para. */
class RateLimited extends Error {}

/**
 * GET no TheSportsDB com ritmo + backoff de 429. Retorna o JSON, ou `null` se a
 * resposta foi OK mas inútil. Lança RateLimited se o 429 persistir.
 */
async function tsdbGet(path: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    await sleep(PACE_MS);
    let r: Response;
    try {
      r = await fetch(`${TSDB}/${path}`);
    } catch {
      return null; // rede instável: trata como sem-resultado nesta tentativa
    }
    if (r.status === 429) {
      if (attempt >= MAX_429) throw new RateLimited();
      const wait = 15000 * (attempt + 1);
      console.log(`[logos] 429 (rate-limit) — aguardando ${wait / 1000}s e tentando de novo…`);
      await sleep(wait);
      continue;
    }
    if (!r.ok) return null;
    try {
      return await r.json();
    } catch {
      return null;
    }
  }
}

/** Logo da api-sports (alguns vêm como JPEG = fundo BRANCO, sem transparência). */
function isApiSports(u?: string): boolean {
  return !!u && u.includes("media.api-sports.io");
}

/**
 * Descobre quais logos da api-sports são JPEG (fundo branco feio) — só esses
 * valem a pena trocar por um escudo transparente. Os PNG já são transparentes e
 * ficam intactos (sem risco de pegar o escudo errado). Detecção 100% confiável
 * pela assinatura do arquivo (JPEG = ff d8 ff).
 */
async function detectWhiteBg(matches: Match[]): Promise<Set<string>> {
  const urls = [
    ...new Set(matches.flatMap((m) => [m.homeLogo, m.awayLogo]).filter((u): u is string => isApiSports(u))),
  ];
  const white = new Set<string>();
  for (const u of urls) {
    try {
      const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
      if (buf.slice(0, 3).toString("hex") === "ffd8ff") white.add(u);
    } catch {
      /* rede instável — ignora */
    }
  }
  return white;
}

/** Sufixos de ESTADO do Brasil (quebram a busca: "Palmeiras-SP" → "Palmeiras"). */
const BR_STATE = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";

/** Remove acentos e sufixos comuns para melhorar o acerto da busca. */
function cleanName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(new RegExp(`-(${BR_STATE})$`), "") // sufixo de estado: -SP, -RJ, -MG…
    .replace(/\s+(FC|EC|SC|AC|CF|U\d{2}|II|B)$/i, "")
    .trim();
}

async function searchTeam(name: string, sport: string): Promise<string | null> {
  const wantSport = SPORT_TSDB[sport];
  const tries = [TEAM_ALIASES[name], name, cleanName(name)].filter(
    (v, i, a): v is string => !!v && a.indexOf(v) === i,
  );
  for (const q of tries) {
    const data = await tsdbGet(`searchteams.php?t=${encodeURIComponent(q)}`);
    const teams: any[] = data?.teams ?? [];
    if (teams.length === 0) continue;
    const match =
      teams.find((t) => (!wantSport || t.strSport === wantSport) && (t.strBadge || t.strTeamBadge)) ??
      teams.find((t) => t.strBadge || t.strTeamBadge);
    const badge = match?.strBadge || match?.strTeamBadge;
    if (badge) return badge as string;
  }
  return null;
}

async function searchPlayer(name: string, sport: string): Promise<string | null> {
  const wantSport = SPORT_TSDB[sport]; // "Tennis" / "Fighting"
  const tries = [name, cleanName(name)].filter((v, i, a) => a.indexOf(v) === i);
  for (const q of tries) {
    const data = await tsdbGet(`searchplayers.php?p=${encodeURIComponent(q)}`);
    const players: any[] = data?.player ?? [];
    if (players.length === 0) continue;
    // Prioriza o atleta do ESPORTE certo (evita pegar um xará de outro esporte),
    // e o RECORTE (cutout, transparente) antes da foto retangular (thumb).
    const inSport = wantSport ? players.filter((x) => x.strSport === wantSport) : players;
    const pool = inSport.length ? inSport : players;
    const p = pool.find((x) => x.strCutout) ?? pool.find((x) => x.strThumb) ?? pool[0];
    const url = p?.strCutout || p?.strThumb;
    if (url) return url as string;
  }
  return null;
}

async function main(): Promise<void> {
  if (!existsSync(MATCHES_FILE)) {
    console.error(`[logos] ${MATCHES_FILE} não existe. Rode 'npm run feed:harvest' antes.`);
    process.exit(1);
  }
  const matches = JSON.parse(readFileSync(MATCHES_FILE, "utf8")) as Match[];
  const cache = loadCache();

  // Quais logos api-sports são JPEG (fundo branco) — só esses serão trocados.
  const whiteBg = await detectWhiteBg(matches);
  console.log(`[logos] ${whiteBg.size} logos api-sports com fundo branco (JPEG) — serão trocados por transparente.`);
  const needsResolve = (logo?: string) => !logo || (isApiSports(logo) && whiteBg.has(logo));

  // Competidores únicos a resolver (dedupe por nome+tipo).
  type Need = { name: string; sport: string; player: boolean };
  const needs = new Map<string, Need>();
  for (const m of matches) {
    const player = PLAYER_SPORTS.has(m.sport);
    for (const [name, logo] of [
      [m.home, m.homeLogo],
      [m.away, m.awayLogo],
    ] as [string, string | undefined][]) {
      // Mantém um logo TRANSPARENTE já bom; só re-resolve quem não tem logo ou tem
      // um api-sports com FUNDO BRANCO (JPEG).
      if (!needsResolve(logo)) continue;
      if (!player && teamFlagCode(name)) continue; // seleção → bandeira
      const key = `${player ? "player" : "team"}:${name}`;
      if (!needs.has(key)) needs.set(key, { name, sport: m.sport, player });
    }
  }

  const keys = Array.from(needs.keys());
  const pending = keys.filter((k) => !(k in cache));
  console.log(
    `[logos] ${matches.length} jogos · ${keys.length} competidores sem logo · ${pending.length} a buscar · ritmo ${PACE_MS}ms.`,
  );

  let done = 0;
  let hits = 0;
  let stoppedByRate = false;
  for (const key of pending) {
    const need = needs.get(key)!;
    try {
      const url = need.player
        ? await searchPlayer(need.name, need.sport)
        : await searchTeam(need.name, need.sport);
      cache[key] = url ?? ""; // só cacheia respostas OK (achou ou vazio)
      done++;
      if (url) hits++;
    } catch (e) {
      if (e instanceof RateLimited) {
        stoppedByRate = true;
        break; // não cacheia; salva e para — rode de novo para continuar
      }
      // outro erro: deixa sem cache (tenta na próxima rodada)
    }
    if (done % 10 === 0) {
      saveCache(cache);
      console.log(`[logos] ${done}/${pending.length} · ${hits} achados…`);
    }
  }
  saveCache(cache);

  // Aplica as URLs resolvidas no acervo.
  let filled = 0;
  for (const m of matches) {
    const player = PLAYER_SPORTS.has(m.sport);
    const kind = player ? "player" : "team";
    // Preenche quem não tem logo E substitui os api-sports de FUNDO BRANCO por um
    // transparente do TheSportsDB quando encontrado; senão mantém o que havia.
    if (needsResolve(m.homeLogo) && !(!player && teamFlagCode(m.home))) {
      const u = cache[`${kind}:${m.home}`];
      if (u) {
        m.homeLogo = u;
        filled++;
      } else if (m.homeLogo && whiteBg.has(m.homeLogo)) {
        m.homeLogo = undefined; // sem transparente → dropa o JPEG branco (vira monograma escuro)
      }
    }
    if (needsResolve(m.awayLogo) && !(!player && teamFlagCode(m.away))) {
      const u = cache[`${kind}:${m.away}`];
      if (u) {
        m.awayLogo = u;
        filled++;
      } else if (m.awayLogo && whiteBg.has(m.awayLogo)) {
        m.awayLogo = undefined;
      }
    }
  }
  writeFileSync(MATCHES_FILE, JSON.stringify(matches, null, 2), "utf8");

  const homeCov = matches.filter((m) => m.homeLogo || teamFlagCode(m.home)).length;
  const awayCov = matches.filter((m) => m.awayLogo || teamFlagCode(m.away)).length;
  console.log(`[logos] aplicados +${filled} símbolos. Cobertura: casa ${homeCov}/${matches.length}, fora ${awayCov}/${matches.length}.`);
  if (stoppedByRate) {
    const left = keys.filter((k) => !(k in cache)).length;
    console.log(`[logos] ⏸️ rate-limit — ${left} faltando. Rode 'npm run feed:logos' de novo daqui a pouco para continuar.`);
  } else {
    console.log(`[logos] ✅ concluído. Reinicie o gateway para recarregar o acervo.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
