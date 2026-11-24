import { describe, expect, it } from "vitest";
import { canAdd, checkCombo, fits } from "./combos";
import { c, cards, joker } from "./helpers.test-utils";
import type { Combination } from "./cards";

const combo = (type: Combination["type"], codes: string): Combination => ({ id: "x", type, cards: cards(codes), ownerSeat: 0 });

describe("combinations", () => {
  it("R-06 Tria is 3 or 4 cards of one rank in different suits", () => {
    expect(checkCombo(cards("8H 8C 8D"))?.type).toBe("TRIA");
    expect(checkCombo(cards("8H 8C 8D 8S"))?.type).toBe("TRIA");
    expect(checkCombo(cards("8H 8C"))).toBeNull();
    expect(checkCombo(cards("8H 8C 8D 8S JK"))).toBeNull();
    expect(checkCombo(cards("8H 8C 9D"))).toBeNull();
  });

  it("R-06 Tria with two cards of the same suit is invalid", () => {
    expect(checkCombo([c("8H"), c("8H", 1), c("8C")])).toBeNull();
  });

  it("R-07 Serie is 3 to 14 consecutive cards of one suit", () => {
    expect(checkCombo(cards("4H 5H 6H"))?.type).toBe("SERIE");
    expect(checkCombo(cards("4H 5H"))).toBeNull();
    expect(checkCombo(cards("4H 5H 7H"))).toBeNull();
    expect(checkCombo(cards("4H 5C 6H"))).toBeNull();
    expect(checkCombo(cards("6H 5H 4H"))).toBeNull();
  });

  it("R-07 Ace is low (A-2-3) or high (Q-K-A), no wrap-around", () => {
    expect(checkCombo(cards("AS 2S 3S"))?.type).toBe("SERIE");
    expect(checkCombo(cards("QS KS AS"))?.type).toBe("SERIE");
    expect(checkCombo(cards("KS AS 2S"))).toBeNull();
  });

  it("R-07 longest Serie is 14 cards, A through K then A", () => {
    const full = [...cards("AH 2H 3H 4H 5H 6H 7H 8H 9H 10H JH QH KH"), c("AH", 1)];
    expect(checkCombo(full)?.type).toBe("SERIE");
    expect(checkCombo([...full, joker()])).toBeNull();
  });

  it("R-08 a joker substitutes for any card", () => {
    expect(checkCombo(cards("8H JK 8D"))?.type).toBe("TRIA");
    expect(checkCombo(cards("4H JK 6H"))?.type).toBe("SERIE");
    expect(checkCombo(cards("JK 5H 6H"))?.type).toBe("SERIE");
  });

  it("R-08 at most one joker per combination", () => {
    expect(checkCombo([joker(0), joker(1), c("8H")])).toBeNull();
    expect(checkCombo([c("4H"), joker(0), joker(1), c("7H")])).toBeNull();
  });

  it("R-09 cards 2 to 10 are worth face value", () => {
    expect(checkCombo(cards("2H 3H 4H"))?.points).toBe(9);
    expect(checkCombo(cards("10H 10C 10D"))?.points).toBe(30);
  });

  it("R-10 J, Q and K are worth 10", () => {
    expect(checkCombo(cards("JH QH KH"))?.points).toBe(30);
  });

  it("R-11 Ace is 1 low, 10 high, 10 in a Tria", () => {
    expect(checkCombo(cards("AH 2H 3H"))?.points).toBe(6);
    expect(checkCombo(cards("QH KH AH"))?.points).toBe(30);
    expect(checkCombo(cards("AH AC AD"))?.points).toBe(30);
  });

  it("R-17 jokers add no points", () => {
    expect(checkCombo(cards("10H JK 10D"))?.points).toBe(20);
    expect(checkCombo(cards("8H JK 10H"))?.points).toBe(18);
  });

  it("R-19 cards can be added at either end of a Serie", () => {
    const serie = combo("SERIE", "4H 5H 6H");
    expect(canAdd(serie, cards("7H 8H"), "end")).toBe(true);
    expect(canAdd(serie, cards("3H"), "start")).toBe(true);
    expect(canAdd(serie, cards("8H"), "end")).toBe(false);
    expect(fits(c("3H"), serie)).toBe(true);
    expect(fits(c("7H"), serie)).toBe(true);
    expect(fits(c("7C"), serie)).toBe(false);
  });

  it("R-19 a fourth suit can be added to a Tria, a fifth cannot", () => {
    expect(canAdd(combo("TRIA", "8H 8C 8D"), cards("8S"), "end")).toBe(true);
    expect(canAdd(combo("TRIA", "8H 8C 8D 8S"), [c("8H", 1)], "end")).toBe(false);
  });

  it("R-21 adding keeps existing cards in place, so a joker cannot move", () => {
    // 4H JK 6H: the joker is the 5. Adding 5H cannot push it out.
    expect(canAdd(combo("SERIE", "4H JK 6H"), cards("5H"), "end")).toBe(false);
    expect(canAdd(combo("SERIE", "4H JK 6H"), cards("7H"), "end")).toBe(true);
  });
});
