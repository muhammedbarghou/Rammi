import { type Card, type Combination, type Rank, RANKS } from "./cards";

/** Position in a run: A=1 (or 14 when high), 2..10, J=11, Q=12, K=13. */
const rankNumber = (rank: Rank) => RANKS.indexOf(rank) + 1;

/** R-09 to R-11: points of a card at a run position (1 = low ace, 14 = high ace). */
const positionPoints = (pos: number) => (pos === 1 ? 1 : Math.min(pos, 10));

function triaPoints(cards: Card[]): number | null {
  if (cards.length < 3 || cards.length > 4) return null;
  const naturals = cards.filter((card) => card.rank !== "JOKER");
  if (cards.length - naturals.length > 1) return null; // R-08
  if (new Set(naturals.map((card) => card.rank)).size !== 1) return null;
  if (new Set(naturals.map((card) => card.suit)).size !== naturals.length) return null; // R-06
  return naturals.reduce((sum, card) => sum + (card.rank === "A" ? 10 : positionPoints(rankNumber(card.rank as Rank))), 0);
}

/** Cards must be in run order, low to high. The joker's index is the card it stands for. */
function seriePoints(cards: Card[]): number | null {
  if (cards.length < 3 || cards.length > 14) return null;
  const naturals = cards.filter((card) => card.rank !== "JOKER");
  if (cards.length - naturals.length > 1) return null; // R-08
  if (new Set(naturals.map((card) => card.suit)).size !== 1) return null;
  for (let start = 1; start + cards.length - 1 <= 14; start++) {
    const matches = cards.every(
      (card, i) => card.rank === "JOKER" || rankNumber(card.rank) === start + i || (card.rank === "A" && start + i === 14),
    );
    if (matches) return cards.reduce((sum, card, i) => sum + (card.rank === "JOKER" ? 0 : positionPoints(start + i)), 0);
  }
  return null;
}

/** Validates a combination (R-06 to R-08). Points count natural cards only (R-17). */
export function checkCombo(cards: Card[]): { type: Combination["type"]; points: number } | null {
  const tria = triaPoints(cards);
  if (tria !== null) return { type: "TRIA", points: tria };
  const serie = seriePoints(cards);
  return serie === null ? null : { type: "SERIE", points: serie };
}

/** R-19, R-21: cards go on one end, existing cards never move. */
export function canAdd(combo: Combination, cards: Card[], side: "start" | "end"): boolean {
  const next = side === "start" ? [...cards, ...combo.cards] : [...combo.cards, ...cards];
  return cards.length > 0 && checkCombo(next)?.type === combo.type;
}

export const fits = (card: Card, combo: Combination) => canAdd(combo, [card], "start") || canAdd(combo, [card], "end");
