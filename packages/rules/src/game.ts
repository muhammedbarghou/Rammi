import { type Card, type Combination, type Rng, createDeck, secureRandom, shuffle } from "./cards";
import { canAdd, checkCombo, fits } from "./combos";

export const OPENING_MIN = 71;
export const TURN_SECONDS = 15;
export const MAX_MISSED_TURNS = 3;

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

export type Move =
  | { kind: "draw" }
  | { kind: "takeFirstDiscard" }
  | { kind: "takeDiscard" }
  | { kind: "layDown"; combos: string[][] }
  | { kind: "add"; comboId: string; cardIds: string[]; side: "start" | "end" }
  | { kind: "swapJoker"; comboId: string; cardId: string }
  | { kind: "discard"; cardId: string }
  /** Sent by the server when the turn timer runs out (R-25). */
  | { kind: "timeout" };

/** R-18: a card that fits the next player's combinations cannot be discarded. */
export function canDiscard(s: RoundState, seat: number, card: Card): boolean {
  const next = s.players[nextSeat(s, seat)]!;
  if (next.seat === seat || next.hand.length <= 1) return true;
  if (card.rank === "JOKER") return !next.opened; // confirmed: an opened next player could add it anywhere
  return !s.combinations.some((combo) => combo.ownerSeat === next.seat && fits(card, combo));
}

/** Applies one move by `seat` and returns the new state. Throws RuleError if illegal. */
export function applyMove(prev: RoundState, seat: number, move: Move): RoundState {
  if (prev.phase === "over") throw new RuleError("R-23", "the round is over");
  if (seat !== prev.activeSeat) throw new RuleError("TURN", "not your turn");
  const s = structuredClone(prev);
  const p = s.players[seat]!;

  switch (move.kind) {
    case "draw":
      expectPhase(s, "draw");
      drawFromPile(s, p);
      s.turn.drew = "pile";
      s.phase = "play";
      break;

    case "takeFirstDiscard":
      expectPhase(s, "draw");
      if (!s.firstDiscard) throw new RuleError("R-03a", "the first discard is not available");
      p.hand.push(s.firstDiscard);
      s.firstDiscard = null;
      s.turn.drew = "first";
      s.phase = "play";
      break;

    case "takeDiscard": {
      expectPhase(s, "draw");
      if (p.turnsTaken === 0) throw new RuleError("R-14", "your first turn must draw from the draw pile");
      const top = s.discardPile.pop();
      if (!top) throw new RuleError("R-13", "the discard pile is empty");
      p.hand.push(top);
      s.turn.drew = "discard";
      s.turn.takenCardId = top.id;
      s.phase = "play";
      break;
    }

    case "layDown":
      layDown(s, p, move.combos);
      break;

    case "add": {
      expectTalaj(s);
      if (!p.opened) throw new RuleError("R-19", "open before adding to the table");
      const combo = findCombo(s, move.comboId);
      const cards = takeCards(p, move.cardIds);
      if (!canAdd(combo, cards, move.side)) throw new RuleError("R-19", "those cards do not fit that combination");
      combo.cards = move.side === "start" ? [...cards, ...combo.cards] : [...combo.cards, ...cards];
      keepOneCard(p);
      break;
    }

    case "swapJoker": {
      expectTalaj(s);
      if (!p.opened) throw new RuleError("R-22", "open before swapping a joker");
      const combo = findCombo(s, move.comboId);
      const j = combo.cards.findIndex((card) => card.rank === "JOKER");
      if (combo.type !== "TRIA" || j < 0) throw new RuleError("R-22", "only a joker in a Tria can be swapped");
      const [real] = takeCards(p, [move.cardId]);
      const rank = combo.cards.find((card) => card.rank !== "JOKER")!.rank;
      if (real!.rank !== rank || combo.cards.some((card) => card.suit === real!.suit)) {
        throw new RuleError("R-22", "swap with the same rank in a missing suit");
      }
      const joker = combo.cards[j]!;
      combo.cards[j] = real!;
      p.hand.push(joker);
      s.turn.jokerToPlace = joker.id;
      break;
    }

    case "discard": {
      expectPhase(s, "play");
      const card = p.hand.find((c) => c.id === move.cardId);
      if (!card) throw new RuleError("CARD", "that card is not in your hand");
      const inHand = (id: string | null) => id !== null && p.hand.some((c) => c.id === id);
      if (inHand(s.turn.jokerToPlace)) throw new RuleError("R-22", "lay the swapped joker down first");
      if (inHand(s.turn.takenCardId)) throw new RuleError("R-15", "use the discard you took in a talaj");
      // PRD is silent when every card is blocked; allowing any card keeps the turn from getting stuck.
      if (!canDiscard(s, seat, card) && p.hand.some((c) => canDiscard(s, seat, c))) {
        throw new RuleError("R-18", "the next player could use that card");
      }
      p.missedTurns = 0;
      finishTurn(s, p, card);
      break;
    }

    case "timeout": {
      if (++p.missedTurns >= MAX_MISSED_TURNS) {
        forfeit(s, p); // R-26
        break;
      }
      // R-25: draw if needed, then discard the newest card that R-18 allows.
      if (s.phase === "draw") {
        drawFromPile(s, p);
        s.turn.drew = "pile";
      }
      finishTurn(s, p, [...p.hand].reverse().find((c) => canDiscard(s, seat, c)) ?? p.hand.at(-1)!);
      break;
    }
  }
  return s;
}

/** R-26: the player leaves; if one player or team is left, they win. */
function forfeit(s: RoundState, p: Player) {
  p.forfeited = true;
  const left = s.players.filter((q) => !q.forfeited);
  if (new Set(left.map((q) => (s.companion ? q.seat % 2 : q.seat))).size === 1) {
    s.phase = "over";
    s.winner = left[0]!.seat;
    return;
  }
  advance(s, p.seat);
}

function expectPhase(s: RoundState, phase: RoundState["phase"]) {
  if (s.phase !== phase) throw new RuleError("TURN", phase === "draw" ? "you already drew" : "draw a card first");
}

function expectTalaj(s: RoundState) {
  expectPhase(s, "play");
  if (s.turn.drew === null) throw new RuleError("R-03a", "the shuffler only discards on the first turn");
  if (s.turn.drew === "first") throw new RuleError("R-03a", "no talaj in the turn you take the first discard");
}

function findCombo(s: RoundState, id: string): Combination {
  const combo = s.combinations.find((x) => x.id === id);
  if (!combo) throw new RuleError("CARD", "no such combination");
  return combo;
}

function takeCards(p: Player, ids: string[]): Card[] {
  return ids.map((id) => {
    const i = p.hand.findIndex((card) => card.id === id);
    if (i < 0) throw new RuleError("CARD", `card ${id} is not in your hand`);
    return p.hand.splice(i, 1)[0]!;
  });
}

/** R-23 with 4.4: every turn ends with a discard, so the last card can't be laid down. */
function keepOneCard(p: Player) {
  if (p.hand.length === 0) throw new RuleError("R-23", "keep one card to discard");
}

/** R-24: an empty draw pile is rebuilt from the discard pile, top card stays. */
function drawFromPile(s: RoundState, p: Player) {
  if (s.drawPile.length === 0) {
    const top = s.discardPile.pop();
    s.drawPile = shuffle(s.discardPile);
    s.discardPile = top ? [top] : [];
  }
  const card = s.drawPile.pop();
  if (!card) throw new RuleError("R-24", "no cards left to draw");
  p.hand.push(card);
}

function layDown(s: RoundState, p: Player, groups: string[][]) {
  expectTalaj(s);
  if (groups.length === 0) throw new RuleError("CARD", "nothing to lay down");
  const laid = groups.map((ids) => {
    const cards = takeCards(p, ids);
    const checked = checkCombo(cards);
    if (!checked) throw new RuleError("COMBO", "not a valid Tria or Serie");
    return { ...checked, cards };
  });

  if (!p.opened) {
    const total = laid.reduce((sum, x) => sum + x.points, 0); // natural cards only (R-17)
    const hasSerie = laid.some((x) => x.type === "SERIE");
    if (s.companion && s.players[partnerSeat(p.seat)]!.opened) {
      if (!hasSerie) throw new RuleError("R-17b", "your partner has opened, you need a Serie");
    } else {
      if (!hasSerie || !laid.some((x) => x.type === "TRIA")) throw new RuleError("R-17", "the opening needs a Tria and a Serie");
      const rule = s.openingThreshold === OPENING_MIN ? "R-16" : "R-17a";
      if (total < s.openingThreshold) throw new RuleError(rule, `the opening needs ${s.openingThreshold} points without jokers`);
      s.openingThreshold = total + 1;
    }
    p.opened = true;
    p.openingTotal = total;
  }

  keepOneCard(p);
  for (const x of laid) s.combinations.push({ id: `c${s.combinations.length}`, type: x.type, cards: x.cards, ownerSeat: p.seat });
}

function finishTurn(s: RoundState, p: Player, card: Card) {
  p.hand = p.hand.filter((c) => c.id !== card.id);
  if (s.turn.drew === null) s.firstDiscard = card; // R-03a: the shuffler's opening discard sits apart
  else s.discardPile.push(card);
  p.turnsTaken++;

  if (p.hand.length === 0) {
    s.phase = "over"; // R-23
    s.winner = p.seat;
    return;
  }
  advance(s, p.seat);
}

function advance(s: RoundState, seat: number) {
  // R-03a: once everyone has had a turn, the first discard goes under the discard pile.
  if (s.firstDiscard && s.players.every((q) => q.forfeited || q.turnsTaken > 0)) {
    s.discardPile.unshift(s.firstDiscard);
    s.firstDiscard = null;
  }
  s.activeSeat = nextSeat(s, seat);
  s.phase = "draw";
  s.turn = newTurn();
}
