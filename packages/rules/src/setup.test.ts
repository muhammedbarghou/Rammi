import { describe, expect, it } from "vitest";
import { createDeck, shuffle } from "./cards";
import { nextSeat, partnerSeat, randomSeat, startRound } from "./game";

describe("setup", () => {
  it("R-01 a table has 2 to 4 players", () => {
    expect(() => startRound({ playerCount: 1, shuffler: 0 })).toThrow("R-01");
    expect(() => startRound({ playerCount: 5, shuffler: 0 })).toThrow("R-01");
    expect(startRound({ playerCount: 2, shuffler: 0 }).players).toHaveLength(2);
    expect(startRound({ playerCount: 4, shuffler: 0 }).players).toHaveLength(4);
  });

  it("R-02 deck is two 52-card decks plus 4 jokers", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((card) => card.id)).size).toBe(108);
    expect(deck.filter((card) => card.rank === "JOKER")).toHaveLength(4);
    expect(deck.filter((card) => card.rank === "8" && card.suit === "H")).toHaveLength(2);
  });

  it("R-02 shuffle keeps every card", () => {
    const deck = createDeck();
    expect(shuffle(deck).map((card) => card.id).sort()).toEqual(deck.map((card) => card.id).sort());
  });

  it("R-03 shuffler gets 15 cards, others 14, the rest is the draw pile, no face-up card", () => {
    const s = startRound({ playerCount: 4, shuffler: 2 });
    expect(s.players.map((p) => p.hand.length)).toEqual([14, 14, 15, 14]);
    expect(s.drawPile).toHaveLength(108 - 15 - 14 * 3);
    expect(s.discardPile).toEqual([]);
    expect(s.firstDiscard).toBeNull();
  });

  it("R-04 the shuffler starts the round, the next shuffler is the player to the left", () => {
    const s = startRound({ playerCount: 3, shuffler: 2 });
    expect(s.activeSeat).toBe(2);
    expect(nextSeat(s, s.shuffler)).toBe(0);
  });

  it("R-04 the first shuffler is a random seat", () => {
    expect(randomSeat(4, () => 0)).toBe(0);
    expect(randomSeat(4, () => 0.99)).toBe(3);
  });

  it("R-05 companion mode needs 4 players, partners sit opposite", () => {
    expect(() => startRound({ playerCount: 3, shuffler: 0, companion: true })).toThrow("R-05");
    expect(startRound({ playerCount: 4, shuffler: 0, companion: true }).companion).toBe(true);
    expect([0, 1, 2, 3].map(partnerSeat)).toEqual([2, 3, 0, 1]);
  });

  it("R-26 a forfeited player is dealt nothing and skipped in turn order", () => {
    const s = startRound({ playerCount: 3, shuffler: 0, forfeited: [1] });
    expect(s.players[1]!.hand).toEqual([]);
    expect(nextSeat(s, 0)).toBe(2);
  });
});
