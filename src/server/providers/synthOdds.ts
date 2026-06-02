/**
 * Síntese de odds para o MODO DEMONSTRAÇÃO.
 *
 * O plano FREE da API-Football retorna centenas de jogos REAIS (times, ligas,
 * escudos) mas só fornece odds para uma fração deles. Para a vitrine ficar
 * completa — todos os jogos reais no board — geramos odds plausíveis para os
 * fixtures sem odds, usando o mesmo modelo de Poisson das odds ao vivo
 * (`odds.ts`). O resultado é indistinguível de um board real, e quando o cliente
 * assinar o plano pago as odds reais entram no lugar.
 *
 * Mantém o mesmo conjunto de mercados e a mesma convenção de IDs
 * (`makeSelectionId`) do feed real, então a precificação ao vivo (DemoEngine) e
 * a liquidação (store) funcionam igual.
 */

import type { Market, Score } from "../../shared/types";
import { makeSelectionId } from "../../shared/ids";
import { computeProbabilities, probToOdds } from "../odds";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Gera um conjunto coerente de mercados com odds plausíveis para um jogo. */
export function synthesizeMarkets(fid: string, home: string, away: string): Market[] {
  // Força ofensiva plausível: leve vantagem de casa + supremacia aleatória.
  const sup = Math.random() - 0.45; // viés p/ casa
  const total = 1.05 + Math.random() * 1.15; // gols esperados ~2.1..3.4 por lado-base
  const lambdaHome = clamp(total * (0.5 + sup * 0.45) + 0.18, 0.35, 3.2);
  const lambdaAway = clamp(total * (0.5 - sup * 0.45), 0.3, 3.0);

  const p = computeProbabilities(lambdaHome, lambdaAway, { home: 0, away: 0 }, 0);
  const ph = computeProbabilities(lambdaHome / 2, lambdaAway / 2, { home: 0, away: 0 }, 0); // 1º tempo

  const sel = (key: string, sk: string, label: string, prob: number) => ({
    id: makeSelectionId(fid, key, sk),
    label,
    odds: probToOdds(prob),
    suspended: false,
  });

  const homeAway = p.home + p.away || 1;

  return [
    { key: "1x2", name: "Resultado Final", selections: [
      sel("1x2", "home", home, p.home), sel("1x2", "draw", "Empate", p.draw), sel("1x2", "away", away, p.away),
    ] },
    { key: "ou25", name: "Total de Gols 2.5", selections: [
      sel("ou25", "over", "Mais 2.5", p.over25), sel("ou25", "under", "Menos 2.5", p.under25),
    ] },
    { key: "btts", name: "Ambos Marcam", selections: [
      sel("btts", "yes", "Sim", p.bttsYes), sel("btts", "no", "Não", p.bttsNo),
    ] },
    { key: "dc", name: "Dupla Chance", selections: [
      sel("dc", "1x", "Casa ou Empate (1X)", p.home + p.draw),
      sel("dc", "12", "Casa ou Fora (12)", p.home + p.away),
      sel("dc", "x2", "Empate ou Fora (X2)", p.draw + p.away),
    ] },
    { key: "dnb", name: "Empate Anula Aposta", selections: [
      sel("dnb", "home", home, p.home / homeAway), sel("dnb", "away", away, p.away / homeAway),
    ] },
    { key: "1h_1x2", name: "Vencedor 1º Tempo", selections: [
      sel("1h_1x2", "home", home, ph.home), sel("1h_1x2", "draw", "Empate", ph.draw), sel("1h_1x2", "away", away, ph.away),
    ] },
    { key: "oddeven", name: "Total Par/Ímpar", selections: [
      sel("oddeven", "odd", "Ímpar", 0.5), sel("oddeven", "even", "Par", 0.5),
    ] },
  ];
}

/**
 * Odds AO VIVO derivadas do placar e do minuto reais (modelo de Poisson de gols
 * restantes). Usado pelo modo `live`: o feed real da API-Football traz placar e
 * minuto, mas não odds no plano grátis — então precificamos os mercados a partir
 * do estado real do jogo (reagem ao placar/tempo, como uma casa de verdade). Com
 * o plano pago, troca-se por odds ao vivo reais.
 */
export function liveMarkets(fid: string, home: string, away: string, score: Score, minute: number): Market[] {
  const lambdaHome = 1.45;
  const lambdaAway = 1.25;
  const p = computeProbabilities(lambdaHome, lambdaAway, score, minute);
  const sel = (key: string, sk: string, label: string, prob: number) => ({
    id: makeSelectionId(fid, key, sk),
    label,
    odds: probToOdds(prob),
    suspended: false,
  });
  const homeAway = p.home + p.away || 1;
  return [
    { key: "1x2", name: "Resultado Final", selections: [
      sel("1x2", "home", home, p.home), sel("1x2", "draw", "Empate", p.draw), sel("1x2", "away", away, p.away),
    ] },
    { key: "ou25", name: "Total de Gols 2.5", selections: [
      sel("ou25", "over", "Mais 2.5", p.over25), sel("ou25", "under", "Menos 2.5", p.under25),
    ] },
    { key: "btts", name: "Ambos Marcam", selections: [
      sel("btts", "yes", "Sim", p.bttsYes), sel("btts", "no", "Não", p.bttsNo),
    ] },
    { key: "dc", name: "Dupla Chance", selections: [
      sel("dc", "1x", "Casa ou Empate (1X)", p.home + p.draw),
      sel("dc", "12", "Casa ou Fora (12)", p.home + p.away),
      sel("dc", "x2", "Empate ou Fora (X2)", p.draw + p.away),
    ] },
    { key: "dnb", name: "Empate Anula Aposta", selections: [
      sel("dnb", "home", home, p.home / homeAway), sel("dnb", "away", away, p.away / homeAway),
    ] },
  ];
}
