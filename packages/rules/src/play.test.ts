import { describe, expect, it } from "vitest";
import { type Move, type RoundState, TURN_SECONDS, applyMove, canDiscard } from "./game";
import { c, cards, joker, makeState } from "./helpers.test-utils";
import type { Combination } from "./cards";

const ids = (codes: string) => cards(codes).map((card) => card.id);
const go = (s: RoundState, seat: number, ...moves: Move[]) => moves.reduce((st, m) => applyMove(st, seat, m), s);
const draw: Move = { kind: "draw" };
const discard = (code: string): Move => ({ kind: "discard", cardId: code === "JK" ? joker().id : c(code).id });
const lay = (...groups: string[]): Move => ({ kind: "layDown", combos: groups.map(ids) });
const table = (ownerSeat: number, type: Combination["type"], codes: string): Combination => ({
  id: `t${ownerSeat}${codes}`,
  type,
  cards: cards(codes),
  ownerSeat,
});

// 8H 8C 8D 8S = 32, 9S 10S JS QS = 39: exactly 71.
const TRIA_32 = "8H 8C 8D 8S";
const SERIE_39 = "9S 10S JS QS";

/** The shuffler's first turn: no one has played yet. */
const roundStart = (hands: string[]) => {
  const s = makeState(hands.map(cards), { phase: "play" });
  for (const p of s.players) p.turnsTaken = 0;
  return s;
};

describe("turns and drawing", () => {
  it("R-03a the shuffler does not draw, discards one card as the first discard", () => {
    const s = roundStart(["2H 3H", "4H 5H", "6H 7H"]);
    expect(() => go(s, 0, draw)).toThrow();
    expect(() => go(s, 0, lay("2H 3H 4H"))).toThrow("R-03a");
    const after = go(s, 0, discard("2H"));
    expect(after.firstDiscard?.id).toBe(c("2H").id);
    expect(after.discardPile).toEqual([]);
    expect(after.players[0]!.hand).toHaveLength(1);
    expect(after.activeSeat).toBe(1);
  });

  it("R-03a any player may take the first discard in the first round, even on their first turn", () => {
    let s = go(roundStart(["2H 3H", "4H 5H", "6H 7H"]), 0, discard("2H"));
    s = go(s, 1, draw, discard("4H")); // player 2 passes on it
    s = go(s, 2, { kind: "takeFirstDiscard" });
    expect(s.players[2]!.hand.map((card) => card.id)).toContain(c("2H").id);
    expect(s.firstDiscard).toBeNull();
  });

  it("R-03a taking the first discard counts as the draw and allows no talaj that turn", () => {
    let s = go(roundStart(["2H 3H", "4H 5H 3D 3C"]), 0, discard("3H"));
    s = go(s, 1, { kind: "takeFirstDiscard" });
    expect(() => go(s, 1, draw)).toThrow();
    expect(() => go(s, 1, lay("3H 3D 3C"))).toThrow("R-03a");
    expect(go(s, 1, discard("4H")).activeSeat).toBe(0);
  });

  it("R-03a after the first round of turns the first discard joins the discard pile", () => {
    let s = go(roundStart(["2H 3H", "4H 5H", "6H 7H"]), 0, discard("2H"));
    s = go(s, 1, draw, discard("4H"));
    expect(s.firstDiscard).not.toBeNull();
    s = go(s, 2, draw, discard("6H"));
    expect(s.firstDiscard).toBeNull();
    expect(s.discardPile.map((card) => card.id)).toEqual(ids("2H 4H 6H"));
    expect(() => go(s, 0, { kind: "takeFirstDiscard" })).toThrow("R-03a");
  });

  it("R-12 turn time limit is 15 seconds", () => {
    expect(TURN_SECONDS).toBe(15);
  });

  it("R-13 only the top discard card may be taken", () => {
    const s = makeState([cards("5H 6H 2C"), cards("9D")], {
      discardPile: cards("KD 7H"),
      combinations: [table(0, "SERIE", "2H 3H 4H")],
    });
    s.players[0]!.opened = true;
    const after = go(s, 0, { kind: "takeDiscard" }, lay("5H 6H 7H"));
    expect(after.discardPile.map((card) => card.id)).toEqual(ids("KD"));
  });

  it("R-14 a player's first turn must draw from the draw pile", () => {
    const s = makeState([cards("5H 6H"), cards("9D")], { discardPile: cards("7H") });
    s.players[0]!.turnsTaken = 0;
    expect(() => go(s, 0, { kind: "takeDiscard" })).toThrow("R-14");
  });

  it("R-15 the discard card must be used in a talaj that turn", () => {
    const s = makeState([cards("2C 3D"), cards("9D")], { discardPile: cards("7H") });
    s.players[0]!.opened = true;
    expect(() => go(s, 0, { kind: "takeDiscard" }, discard("2C"))).toThrow("R-15");
    expect(() => go(s, 0, { kind: "takeDiscard" }, discard("7H"))).toThrow("R-15");
  });

  it("R-15 an opened player takes the 8 and adds it with their 7 to a 4-5-6 Serie", () => {
    const s = makeState([cards("7H 2C"), cards("9D KS")], {
      discardPile: cards("8H"),
      combinations: [table(1, "SERIE", "4H 5H 6H")],
    });
    s.players[0]!.opened = true;
    const after = go(
      s,
      0,
      { kind: "takeDiscard" },
      { kind: "add", comboId: s.combinations[0]!.id, cardIds: ids("7H 8H"), side: "end" },
      discard("2C"),
    );
    expect(after.combinations[0]!.cards.map((card) => card.id)).toEqual(ids("4H 5H 6H 7H 8H"));
  });

  it("R-15 an unopened player may take the discard to complete the opening", () => {
    const s = makeState([cards(`${TRIA_32} 9S 10S JS 2C`), cards("9D")], { discardPile: cards("QS") });
    const after = go(s, 0, { kind: "takeDiscard" }, lay(TRIA_32, SERIE_39), discard("2C"));
    expect(after.players[0]!.opened).toBe(true);
  });

  it("R-24 an empty draw pile is rebuilt from the discard pile, keeping its top card", () => {
    const s = makeState([cards("2C"), cards("9D")], { drawPile: [], discardPile: cards("3H 4H 5H") });
    const after = go(s, 0, draw);
    expect(after.discardPile.map((card) => card.id)).toEqual(ids("5H"));
    expect(after.drawPile).toHaveLength(1);
    expect(after.players[0]!.hand).toHaveLength(2);
  });
});

describe("opening", () => {
  it("R-16 the opening needs 71 points or more in one turn", () => {
    const s = makeState([cards("10S 10H 10D 8H 9H 10H 2C"), cards("9D")]);
    expect(() => go(s, 0, draw, lay("10S 10H 10D", "8H 9H 10H"))).toThrow("R-16"); // 57, the PRD example
    const ok = makeState([cards(`${TRIA_32} ${SERIE_39} 2C`), cards("9D")]);
    const after = go(ok, 0, draw, lay(TRIA_32, SERIE_39));
    expect(after.players[0]!.opened).toBe(true);
    expect(after.players[0]!.openingTotal).toBe(71);
  });

  it("R-16 the opening cannot be split across turns", () => {
    const s = makeState([cards(`${TRIA_32} ${SERIE_39} 2C`), cards("9D")]);
    expect(() => go(s, 0, draw, lay(TRIA_32))).toThrow("R-17");
    expect(() => go(s, 0, draw, lay(SERIE_39))).toThrow("R-17");
  });

  it("R-17 opening needs a Tria and a Serie", () => {
    const s = makeState([cards("KH KC KD QH QC QD JH JC JD 2C"), cards("9D")]);
    expect(() => go(s, 0, draw, lay("KH KC KD", "QH QC QD", "JH JC JD"))).toThrow("R-17"); // 90 points, no Serie
  });

  it("R-17 a joker cannot help reach 71", () => {
    // 24 + 39 = 63 natural; the joker as KS adds nothing.
    const s = makeState([cards(`8H 8C 8D ${SERIE_39} JK 2C`), cards("9D")]);
    expect(() => go(s, 0, draw, lay("8H 8C 8D", `${SERIE_39} JK`))).toThrow("R-16");
  });

  it("R-17 a joker can be used once 71 is reached without it", () => {
    const s = makeState([cards(`${TRIA_32} ${SERIE_39} JK 2C`), cards("9D")]);
    const after = go(s, 0, draw, lay(TRIA_32, `${SERIE_39} JK`));
    expect(after.players[0]!.openingTotal).toBe(71);
  });

  it("R-17a each later opener must lay more than the previous opening", () => {
    const hand = () => cards(`${TRIA_32} ${SERIE_39} KS 2C`);
    let s = makeState([hand(), hand(), cards("9D")]);
    s = go(s, 0, draw, lay(TRIA_32, SERIE_39), discard("2C"));
    expect(s.openingThreshold).toBe(72);
    expect(() => go(s, 1, draw, lay(TRIA_32, SERIE_39))).toThrow("R-17a");
    s = go(s, 1, draw, lay(TRIA_32, `${SERIE_39} KS`));
    expect(s.openingThreshold).toBe(82);
  });

  it("R-17b in companion mode the partner of an opened player only needs a Serie", () => {
    const s = makeState([cards("4H 5H 6H 2C"), cards("9D 9C"), cards("9D 9C"), cards("9D 9C")], {
      companion: true,
      openingThreshold: 90,
    });
    s.players[2]!.opened = true;
    expect(() => go(s, 0, draw, lay("4H 5H 6H"))).not.toThrow();
    expect(go(s, 0, draw, lay("4H 5H 6H")).openingThreshold).toBe(90);
    s.players[2]!.opened = false;
    expect(() => go(s, 0, draw, lay("4H 5H 6H"))).toThrow("R-17");
  });

  it("R-17b without an opened partner the normal opening applies", () => {
    const s = makeState([cards("4H 5H 6H 2C"), cards("9D 9C"), cards("9D 9C"), cards("9D 9C")], { companion: true });
    s.players[1]!.opened = true; // an opponent, not the partner
    expect(() => go(s, 0, draw, lay("4H 5H 6H"))).toThrow("R-17");
  });
});

describe("after opening", () => {
  const opened = (hands: string[], combinations: Combination[]) => {
    const s = makeState(hands.map(cards), { combinations });
    s.players[0]!.opened = true;
    return s;
  };

  it("R-18 cannot discard a card that fits the next player's combination", () => {
    const s = opened(["7H 2C", "9D KS"], [table(1, "SERIE", "4H 5H 6H")]);
    expect(() => go(s, 0, draw, discard("7H"))).toThrow("R-18");
    expect(() => go(s, 0, draw, discard("2C"))).not.toThrow();
  });

  it("R-18 only the next player's combinations count", () => {
    const s = opened(["7H 2C", "9D KS", "9D KS"], [table(2, "SERIE", "4H 5H 6H")]);
    expect(() => go(s, 0, draw, discard("7H"))).not.toThrow();
  });

  it("R-18 allowed when the next player has only one card", () => {
    const s = opened(["7H 2C", "9D"], [table(1, "SERIE", "4H 5H 6H")]);
    expect(() => go(s, 0, draw, discard("7H"))).not.toThrow();
  });

  it("R-18 a joker cannot be discarded when the next player has opened", () => {
    const s = opened(["JK 2C", "9D KS"], []);
    expect(canDiscard(s, 0, joker())).toBe(true);
    s.players[1]!.opened = true;
    expect(canDiscard(s, 0, joker())).toBe(false);
  });

  it("R-18 in companion mode the partner's combinations count when the partner plays next", () => {
    const s = opened(["7H 2C", "9D", "9D KS", "9D"], [table(2, "SERIE", "4H 5H 6H")]);
    s.companion = true;
    s.players[1]!.forfeited = true;
    expect(() => go(s, 0, draw, discard("7H"))).toThrow("R-18");
  });

  it("R-18 when every card in hand is blocked, any card may be discarded", () => {
    const s = opened(["7H 3H", "9D KS"], [table(1, "SERIE", "4H 5H 6H")]);
    s.drawPile = [c("3H", 1)];
    expect(() => go(s, 0, draw, discard("7H"))).not.toThrow();
  });

  it("R-19 an opened player may add to any combination, including opponents'", () => {
    const s = opened(["7H 2C", "9D KS"], [table(1, "SERIE", "4H 5H 6H")]);
    const after = go(s, 0, draw, { kind: "add", comboId: s.combinations[0]!.id, cardIds: ids("7H"), side: "end" });
    expect(after.combinations[0]!.cards).toHaveLength(4);
  });

  it("R-19 a player who has not opened cannot add", () => {
    const s = opened(["7H 2C", "9D KS"], [table(1, "SERIE", "4H 5H 6H")]);
    s.players[0]!.opened = false;
    expect(() => go(s, 0, draw, { kind: "add", comboId: s.combinations[0]!.id, cardIds: ids("7H"), side: "end" })).toThrow(
      "R-19",
    );
  });

  it("R-20 after opening new combinations need no minimum", () => {
    const s = opened(["2H 3H 4H 9C", "9D KS"], []);
    const after = go(s, 0, draw, lay("2H 3H 4H"));
    expect(after.combinations).toHaveLength(1);
  });

  it("R-21 cards that do not fit the end of a combination are rejected", () => {
    const s = opened(["8H 2C", "9D KS"], [table(1, "SERIE", "4H 5H 6H")]);
    expect(() => go(s, 0, draw, { kind: "add", comboId: s.combinations[0]!.id, cardIds: ids("8H"), side: "end" })).toThrow(
      "R-19",
    );
  });

  it("R-22 a Tria joker is swapped for either missing suit and must be laid down that turn", () => {
    const tria = table(1, "TRIA", "8H 8C JK");
    for (const real of ["8D", "8S"]) {
      const s = opened([`${real} 4H 5H 2C`, "9D KS"], [tria]);
      const swapped = go(s, 0, draw, { kind: "swapJoker", comboId: tria.id, cardId: c(real).id });
      expect(swapped.combinations[0]!.cards.map((card) => card.id)).toEqual(ids(`8H 8C ${real}`));
      expect(() => go(swapped, 0, discard("2C"))).toThrow("R-22");
      expect(() => go(swapped, 0, discard("JK"))).toThrow("R-22");
      expect(() => go(swapped, 0, lay("4H 5H JK"), discard("2C"))).not.toThrow();
    }
  });

  it("R-22 the swap needs the right rank and a missing suit", () => {
    const tria = table(1, "TRIA", "8H 8C JK");
    const s = opened(["8H 9D 2C", "9D KS"], [tria]);
    s.players[0]!.hand = [c("8H", 1), c("9D"), c("2C")];
    expect(() => go(s, 0, draw, { kind: "swapJoker", comboId: tria.id, cardId: c("8H", 1).id })).toThrow("R-22");
    expect(() => go(s, 0, draw, { kind: "swapJoker", comboId: tria.id, cardId: c("9D").id })).toThrow("R-22");
  });

  it("R-22 a Serie joker cannot be swapped", () => {
    const serie = table(1, "SERIE", "4H JK 6H");
    const s = opened(["5H 2C", "9D KS"], [serie]);
    expect(() => go(s, 0, draw, { kind: "swapJoker", comboId: serie.id, cardId: c("5H").id })).toThrow("R-22");
  });

  it("R-22 the player must already have opened", () => {
    const tria = table(1, "TRIA", "8H 8C JK");
    const s = opened(["8D 2C", "9D KS"], [tria]);
    s.players[0]!.opened = false;
    expect(() => go(s, 0, draw, { kind: "swapJoker", comboId: tria.id, cardId: c("8D").id })).toThrow("R-22");
  });

  it("R-23 a player must keep one card to discard", () => {
    const s = opened(["2H 3H 4H", "9D KS"], []);
    s.phase = "play";
    s.turn.drew = "pile";
    expect(() => go(s, 0, lay("2H 3H 4H"))).toThrow("R-23");
  });

  it("R-23 the round ends when a player discards their last card", () => {
    const s = opened(["5H", "9D KS"], [table(1, "TRIA", "7H 7C 7D")]);
    s.drawPile = cards("7S");
    const after = go(s, 0, draw, { kind: "add", comboId: s.combinations[0]!.id, cardIds: ids("7S"), side: "end" }, discard("5H"));
    expect(after.phase).toBe("over");
    expect(after.winner).toBe(0);
    expect(() => go(after, 1, draw)).toThrow("R-23");
  });
});
