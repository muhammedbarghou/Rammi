import type { RoundState } from "./game";

export const DEFAULT_TARGET = 501;

/** R-27: penalty per seat for a finished round. Forfeited players have left and are not scored. */
export function roundPenalties(s: RoundState): number[] {
  if (s.winner === null) throw new Error("the round is not over");
  return s.players.map((p) => {
    if (p.seat === s.winner || p.forfeited) return 0;
    if (!p.opened) return 100;
    return p.hand.reduce((sum, card) => sum + (card.rank === "JOKER" ? 20 : 10), 0);
  });
}

/** R-28: [team of seats 0+2, team of seats 1+3]. The winning team scores 0. */
export function teamPenalties(s: RoundState): [number, number] {
  const per = roundPenalties(s);
  const team = (t: 0 | 1) => (s.winner! % 2 === t ? 0 : per[t]! + per[t + 2]!);
  return [team(0), team(1)];
}

/** R-29 */
export const isEliminated = (total: number, target = DEFAULT_TARGET) => total >= target;

/** R-29: index of the last player or team still under the target, or null while two or more remain. */
export function gameWinner(totals: number[], out: boolean[] = [], target = DEFAULT_TARGET): number | null {
  const alive = totals.flatMap((total, i) => (isEliminated(total, target) || out[i] ? [] : [i]));
  return alive.length === 1 ? alive[0]! : null;
}
