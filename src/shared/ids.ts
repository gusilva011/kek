import type { MarketKey } from "./types";

/** Chave curta de cada seleção dentro de um mercado. */
export type SelectionKey =
  | "home"
  | "draw"
  | "away"
  | "over"
  | "under"
  | "yes"
  | "no";

/**
 * ID determinístico de uma seleção. Usado tanto pelo motor (ao gerar odds)
 * quanto pelo ledger (ao liquidar), garantindo que os dois lados concordem
 * sobre qual seleção venceu.
 */
export function makeSelectionId(
  matchId: string,
  marketKey: MarketKey | string,
  selKey: SelectionKey | string,
): string {
  return `${matchId}__${marketKey}__${selKey}`;
}
