"use client";

/**
 * Busca o escudo (logo) real de um clube via TheSportsDB (gratuito), com cache
 * em memória + localStorage para não repetir requisições. Falha → null (o
 * componente cai no monograma). Seleções nacionais usam bandeira, não isto.
 */

const memCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
const LS_PREFIX = "logo:v2:";

/** Nomes que a busca do TheSportsDB erra → termo melhor. */
const ALIASES: Record<string, string> = {
  "Clube de Regatas Brasil": "CRB",
  "Athletic Club (MG)": "Athletic Club Brazil",
  "Atletico Goianiense": "Atletico Goianiense",
  "America Mineiro": "America MG",
  "América Mineiro": "America MG",
  "São Bernardo": "Sao Bernardo FC",
  "Vila Nova": "Vila Nova FC",
  "Sport Recife": "Sport Recife",
  "Operario PR": "Operario Ferroviario",
  "Avispa Fukuoka": "Avispa Fukuoka",
};

function searchName(name: string): string {
  return ALIASES[name] ?? name;
}

function fromLS(name: string): string | null | undefined {
  try {
    const v = localStorage.getItem(LS_PREFIX + name);
    if (v === null) return undefined; // nunca buscado
    return v === "" ? null : v; // "" = buscado e não achou
  } catch {
    return undefined;
  }
}
function toLS(name: string, url: string | null): void {
  try {
    localStorage.setItem(LS_PREFIX + name, url ?? "");
  } catch {
    /* ignore */
  }
}

async function fetchBadge(name: string): Promise<string | null> {
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(searchName(name))}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { teams?: { strBadge?: string; strTeamBadge?: string }[] };
  const t = data?.teams?.[0];
  return t?.strBadge || t?.strTeamBadge || null;
}

export async function getTeamLogo(name: string): Promise<string | null> {
  if (memCache.has(name)) return memCache.get(name)!;
  const ls = fromLS(name);
  if (ls !== undefined) {
    memCache.set(name, ls);
    return ls;
  }
  const existing = inflight.get(name);
  if (existing) return existing;

  const p = fetchBadge(name)
    .then((url) => {
      memCache.set(name, url);
      toLS(name, url);
      inflight.delete(name);
      return url;
    })
    .catch(() => {
      inflight.delete(name);
      return null;
    });
  inflight.set(name, p);
  return p;
}

/* ------------------------------------------------------------------ */
/* Foto de ATLETA (esportes individuais: tênis, MMA, boxe)            */
/* ------------------------------------------------------------------ */

const playerMem = new Map<string, string | null>();
const playerInflight = new Map<string, Promise<string | null>>();
const PLAYER_LS = "player:v1:";

async function fetchPlayer(name: string): Promise<string | null> {
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { player?: { strCutout?: string; strThumb?: string }[] };
  const p = data?.player?.[0];
  return p?.strCutout || p?.strThumb || null;
}

/** Foto/recorte de um atleta (TheSportsDB). Cache em memória + localStorage. */
export async function getPlayerPhoto(name: string): Promise<string | null> {
  if (playerMem.has(name)) return playerMem.get(name)!;
  try {
    const v = localStorage.getItem(PLAYER_LS + name);
    if (v !== null) {
      const url = v === "" ? null : v;
      playerMem.set(name, url);
      return url;
    }
  } catch {
    /* ignore */
  }
  const existing = playerInflight.get(name);
  if (existing) return existing;

  const pr = fetchPlayer(name)
    .then((url) => {
      playerMem.set(name, url);
      try {
        localStorage.setItem(PLAYER_LS + name, url ?? "");
      } catch {
        /* ignore */
      }
      playerInflight.delete(name);
      return url;
    })
    .catch(() => {
      playerInflight.delete(name);
      return null;
    });
  playerInflight.set(name, pr);
  return pr;
}
