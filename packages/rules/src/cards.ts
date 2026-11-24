export const SUITS = ["H", "D", "S", "C"] as const;
export type Suit = (typeof SUITS)[number];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

export type Card = { id: string; rank: Rank | "JOKER"; suit: Suit | null; deck: 0 | 1 };
export type Combination = { id: string; type: "TRIA" | "SERIE"; cards: Card[]; ownerSeat: number };

/** R-02: two 52-card decks plus 4 jokers. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const d of [0, 1] as const) {
    for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: `${d}${rank}${suit}`, rank, suit, deck: d });
    for (const n of [0, 1]) deck.push({ id: `${d}JOKER${n}`, rank: "JOKER", suit: null, deck: d });
  }
  return deck;
}

export type Rng = () => number;

/** Uniform in [0, 1) from the platform CSPRNG, so the deal can't be predicted. */
export const secureRandom: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

/** Fisher-Yates, returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = secureRandom): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
