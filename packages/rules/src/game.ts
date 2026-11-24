import { type Card, type Combination, type Rng, createDeck, secureRandom, shuffle } from "./cards";

export const OPENING_MIN = 71;

/** Thrown for any illegal action. `rule` is the PRD rule id it breaks (or "TURN"/"CARD"). */
export class RuleError extends Error {
  readonly rule: string;
  constructor(rule: string, message: string) {
    super(`${rule}: ${message}`);
    this.rule = rule;
  }
}

export type Player = {
  seat: number;
  hand: Card[];
  opened: boolean;
  openingTotal: number | null;
  missedTurns: number;
  turnsTaken: number;
  forfeited: boolean;
};

export type RoundState = {
  players: Player[];
  companion: boolean;
  shuffler: number;
  activeSeat: number;
  /** "play" with turn.drew === null only happens on the shuffler's first turn (R-03a). */
  phase: "draw" | "play" | "over";
  drawPile: Card[];
  /** Last element is the top card. */
  discardPile: Card[];
  firstDiscard: Card | null;
  combinations: Combination[];
  /** Minimum natural points the next opener needs (R-16, R-17a). */
  openingThreshold: number;
  turn: { drew: "pile" | "discard" | "first" | null; takenCardId: string | null; jokerToPlace: string | null };
  winner: number | null;
};

const newTurn = (): RoundState["turn"] => ({ drew: null, takenCardId: null, jokerToPlace: null });

/** R-05: partners sit opposite each other. */
export const partnerSeat = (seat: number) => (seat + 2) % 4;

/** The next seat in turn order that is still at the table (R-04 "to the left"). */
export function nextSeat(s: Pick<RoundState, "players">, seat: number): number {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const p = s.players[(seat + i) % n]!;
    if (!p.forfeited) return p.seat;
  }
  return seat;
}

/** R-04: the first round's shuffler is random. */
export const randomSeat = (playerCount: number, rng: Rng = secureRandom) => Math.floor(rng() * playerCount);

export function startRound(opts: {
  playerCount: number;
  shuffler: number;
  companion?: boolean;
  forfeited?: number[];
  rng?: Rng;
}): RoundState {
  const { playerCount, shuffler, companion = false, forfeited = [], rng = secureRandom } = opts;
  if (playerCount < 2 || playerCount > 4) throw new RuleError("R-01", "a table has 2 to 4 players");
  if (companion && playerCount !== 4) throw new RuleError("R-05", "companion mode needs 4 players");
  if (forfeited.includes(shuffler)) throw new RuleError("R-04", "the shuffler must be at the table");

  const deck = shuffle(createDeck(), rng);
  const players: Player[] = Array.from({ length: playerCount }, (_, seat) => ({
    seat,
    hand: forfeited.includes(seat) ? [] : deck.splice(0, seat === shuffler ? 15 : 14),
    opened: false,
    openingTotal: null,
    missedTurns: 0,
    turnsTaken: 0,
    forfeited: forfeited.includes(seat),
  }));
  return {
    players,
    companion,
    shuffler,
    activeSeat: shuffler,
    phase: "play",
    drawPile: deck,
    discardPile: [],
    firstDiscard: null,
    combinations: [],
    openingThreshold: OPENING_MIN,
    turn: newTurn(),
    winner: null,
  };
}
