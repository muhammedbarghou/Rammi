import { describe, expect, it } from "vitest";
import { type RoundState, applyMove } from "./game";
import { DEFAULT_TARGET, gameWinner, isEliminated, roundPenalties, teamPenalties } from "./scoring";
import { c, cards, makeState } from "./helpers.test-utils";

const timeout = (s: RoundState, seat: number) => applyMove(s, seat, { kind: "timeout" });

describe("timeouts and forfeits", () => {
  it("R-25 on timeout the server draws and discards a card legal under R-18", () => {
    const s = makeState([cards("2C 7H"), cards("9D KS")], {
      drawPile: [c("7H", 1)],
      combinations: [{ id: "t", type: "SERIE", cards: cards("4H 5H 6H"), ownerSeat: 1 }],
    });
    const after = timeout(s, 0);
    expect(after.discardPile.map((card) => card.id)).toEqual([c("2C").id]);
    expect(after.players[0]!.hand).toHaveLength(2);
    expect(after.players[0]!.missedTurns).toBe(1);
    expect(after.activeSeat).toBe(1);
  });

  it("R-25 a timeout after drawing only discards", () => {
    const s = makeState([cards("2C 7H"), cards("9D KS")]);
    const drawn = applyMove(s, 0, { kind: "draw" });
    expect(timeout(drawn, 0).players[0]!.hand).toHaveLength(2);
  });

  it("R-26 three timeouts in a row forfeit, the others continue", () => {
    const s = makeState([cards("2C 7H"), cards("9D KS"), cards("9D KS")]);
    s.players[0]!.missedTurns = 2;
    const after = timeout(s, 0);
    expect(after.players[0]!.forfeited).toBe(true);
    expect(after.phase).toBe("draw");
    expect(after.activeSeat).toBe(1);
  });

  it("R-26 a completed turn resets the timeout count", () => {
    const s = makeState([cards("2C 7H"), cards("9D KS")]);
    s.players[0]!.missedTurns = 2;
    const after = applyMove(applyMove(s, 0, { kind: "draw" }), 0, { kind: "discard", cardId: c("2C").id });
    expect(after.players[0]!.missedTurns).toBe(0);
  });

  it("R-26 if only one player is left, they win", () => {
    const s = makeState([cards("2C 7H"), cards("9D KS")]);
    s.players[0]!.missedTurns = 2;
    const after = timeout(s, 0);
    expect(after.phase).toBe("over");
    expect(after.winner).toBe(1);
  });

  it("R-26 in companion mode a forfeited player's partner keeps playing", () => {
    const hands = () => [cards("2C 7H"), cards("9D KS"), cards("9D KS"), cards("9D KS")];
    const s = makeState(hands(), { companion: true });
    s.players[0]!.missedTurns = 2;
    expect(timeout(s, 0).phase).toBe("draw");

    const lastOfTeam = makeState(hands(), { companion: true });
    lastOfTeam.players[0]!.missedTurns = 2;
    lastOfTeam.players[2]!.forfeited = true;
    const after = timeout(lastOfTeam, 0);
    expect(after.phase).toBe("over");
    expect(after.winner! % 2).toBe(1);
  });
});

describe("scoring", () => {
  const finished = (hands: string[], winner: number, opened: boolean[]) => {
    const s = makeState(hands.map((h) => (h ? cards(h) : [])), { phase: "over", winner });
    s.players.forEach((p, i) => (p.opened = opened[i]!));
    return s;
  };

  it("R-27 winner 0, ordinary card 10, joker 20, never opened 100", () => {
    const s = finished(["", "2C KS JK", "2C 3C 4C 5C 6C"], 0, [true, true, false]);
    expect(roundPenalties(s)).toEqual([0, 40, 100]);
  });

  it("R-27 a player who never opened scores a flat 100", () => {
    const s = finished(["", "JK JK JK 2C 3C 4C 5C 6C 7C 8C 9C"], 0, [true, false]);
    expect(roundPenalties(s)).toEqual([0, 100]);
  });

  it("R-28 the winning team scores 0, the losing team's penalties add up", () => {
    const s = finished(["2C", "", "3C JK", "4C"], 1, [true, true, true, false]);
    s.companion = true;
    expect(teamPenalties(s)).toEqual([10 + 30, 0]);
  });

  it("R-29 the default target is 501 and reaching it eliminates", () => {
    expect(DEFAULT_TARGET).toBe(501);
    expect(isEliminated(500)).toBe(false);
    expect(isEliminated(501)).toBe(true);
    expect(isEliminated(300, 300)).toBe(true);
  });

  it("R-29 the last player or team under the target wins", () => {
    expect(gameWinner([120, 510, 600])).toBe(0);
    expect(gameWinner([120, 400, 600])).toBeNull();
    expect(gameWinner([510, 300])).toBe(1); // 2 players: the one who reaches it loses
    expect(gameWinner([120, 400], [true, false])).toBe(1); // a forfeited player is out
  });
});
