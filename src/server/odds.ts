/**
 * Modelo de probabilidades → odds.
 *
 * Usamos um modelo de Poisson de gols restantes: dado o placar atual, o tempo
 * restante e a força ofensiva de cada time, calculamos a distribuição dos
 * resultados finais e dela derivamos as probabilidades de cada mercado.
 * Sobre a probabilidade "justa" aplicamos a margem da casa (overround).
 *
 * É o mesmo princípio usado por casas reais para precificar mercados ao vivo —
 * por isso as odds reagem de forma crível a gols e à passagem do tempo.
 */

import type { Score } from "../shared/types";

/** Margem da casa embutida nas odds (7% de overround). */
export const HOUSE_MARGIN = 0.07;

/** Limites de odd para evitar valores absurdos. */
const MIN_ODDS = 1.02;
// Teto realista: casas reais raramente exibem odd 1x2 acima disto (em jogos
// muito desequilibrados elas suspendem ou compactam) — evita o "51.00" feio.
const MAX_ODDS = 26;

const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
function factorial(k: number): number {
  return FACTORIALS[k] ?? Infinity;
}

function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/** Converte probabilidade (0–1) em odd decimal, já com a margem da casa. */
export function probToOdds(prob: number, margin = HOUSE_MARGIN): number {
  const p = clamp(prob, 0.001, 0.999);
  const odds = 1 / (p * (1 + margin));
  return roundOdds(clamp(odds, MIN_ODDS, MAX_ODDS));
}

function roundOdds(o: number): number {
  return Math.round(o * 100) / 100;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface MarketProbabilities {
  /** 1x2 */
  home: number;
  draw: number;
  away: number;
  /** Over/Under 2.5 */
  over25: number;
  under25: number;
  /** Ambos marcam */
  bttsYes: number;
  bttsNo: number;
}

/**
 * Calcula as probabilidades de todos os mercados a partir do estado do jogo.
 *
 * @param lambdaHome gols esperados do mandante em 90' (força ofensiva)
 * @param lambdaAway gols esperados do visitante em 90'
 * @param score placar atual
 * @param minute minuto de jogo (0 para pré-jogo)
 */
export function computeProbabilities(
  lambdaHome: number,
  lambdaAway: number,
  score: Score,
  minute: number,
): MarketProbabilities {
  // Fração de jogo restante (pré-jogo = 1).
  const fractionLeft = clamp((90 - minute) / 90, 0, 1);

  // Gols esperados ainda por vir.
  const muHome = lambdaHome * fractionLeft;
  const muAway = lambdaAway * fractionLeft;

  // Distribuição conjunta dos gols restantes (cap de 8 por time é suficiente).
  const CAP = 8;
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver = 0; // total final > 2.5
  // P(mandante termina com >=1 gol) e idem visitante, para o BTTS.
  const homeAlreadyScored = score.home > 0;
  const awayAlreadyScored = score.away > 0;
  const pHomeScores = homeAlreadyScored ? 1 : 1 - Math.exp(-muHome);
  const pAwayScores = awayAlreadyScored ? 1 : 1 - Math.exp(-muAway);

  for (let i = 0; i <= CAP; i++) {
    const pi = poissonPmf(i, muHome);
    for (let j = 0; j <= CAP; j++) {
      const pj = poissonPmf(j, muAway);
      const joint = pi * pj;
      const finalHome = score.home + i;
      const finalAway = score.away + j;

      if (finalHome > finalAway) pHome += joint;
      else if (finalHome === finalAway) pDraw += joint;
      else pAway += joint;

      if (finalHome + finalAway > 2.5) pOver += joint;
    }
  }

  // Normaliza 1x2 (o cap descarta uma fração mínima de probabilidade).
  const total1x2 = pHome + pDraw + pAway || 1;
  pHome /= total1x2;
  pDraw /= total1x2;
  pAway /= total1x2;

  const bttsYes = clamp(pHomeScores * pAwayScores, 0.001, 0.999);

  return {
    home: pHome,
    draw: pDraw,
    away: pAway,
    over25: clamp(pOver, 0.001, 0.999),
    under25: clamp(1 - pOver, 0.001, 0.999),
    bttsYes,
    bttsNo: 1 - bttsYes,
  };
}

/** Pequeno ruído multiplicativo para as odds "respirarem" a cada tick. */
export function jitter(odds: number, magnitude = 0.012): number {
  const factor = 1 + (Math.random() * 2 - 1) * magnitude;
  return roundOdds(clamp(odds * factor, MIN_ODDS, MAX_ODDS));
}
