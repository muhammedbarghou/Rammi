import type { Card, Rank, Suit } from "./cards";
import type { RoundState } from "./game";

/** c("8H") or c("10S", 1): a natural card, same id format as createDeck. */
export function c(code: string, deck: 0 | 1 = 0): Card {
  const rank = code.slice(0, -1) as Rank;
  const suit = code.slice(-1) as Suit;
  return { id: `${deck}${rank}${suit}`, rank, suit, deck };
}

export const joker = (n = 0, deck: 0 | 1 = 0): Card => ({ id: `${deck}JOKER${n}`, rank: "JOKER", suit: null, deck });

export const cards = (codes: string) => codes.split(" ").map((code) => (code === "JK" ? joker() : c(code)));

/** A mid-round state where every player has already taken one turn. */
export function makeState(hands: Card[][], over: Partial<RoundState> = {}): RoundState {
  return {
    players: hands.map((hand, seat) => ({
      seat,
      hand,
      opened: false,
      openingTotal: null,
      missedTurns: 0,
      turnsTaken: 1,
      forfeited: false,
    })),
    companion: false,
    shuffler: 0,
    activeSeat: 0,
    phase: "draw",
    drawPile: [c("2C", 1), c("3C", 1), c("4C", 1)],
    discardPile: [],
    firstDiscard: null,
    combinations: [],
    openingThreshold: 71,
    turn: { drew: null, takenCardId: null, jokerToPlace: null },
    winner: null,
    ...over,
  };
}
