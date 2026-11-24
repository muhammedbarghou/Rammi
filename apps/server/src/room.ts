import { Room, type Client, type Delayed } from "@colyseus/core";
import {
  DEFAULT_TARGET,
  RuleError,
  TURN_SECONDS,
  applyMove,
  gameWinner,
  isEliminated,
  randomSeat,
  roundPenalties,
  startRound,
  teamPenalties,
  type Move,
  type RoundState,
} from "@rami/rules";
import { verifyToken } from "./auth";
import { saveMatch, type MatchResult } from "./save";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no 0/O or 1/I
// shortcut: used codes live in memory, so they become reusable after a restart; move to Postgres for several servers.
const usedCodes = new Set<string>();

function newCode(): string {
  for (;;) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % 32]).join("");
    if (!usedCodes.has(code)) return usedCodes.add(code), code;
  }
}

type Options = { players: number; companion?: boolean; target?: number };
type Seat = { userId: string; client: Client | null };
type RoundLog = MatchResult["rounds"][number];

const str = (x: unknown) => typeof x === "string";
const strs = (x: unknown) => Array.isArray(x) && x.every(str);

/** Trust boundary: client moves must have the right shape. "timeout" is server-only. */
function isMove(x: unknown): x is Move {
  if (typeof x !== "object" || x === null) return false;
  const m = x as Record<string, unknown>;
  switch (m.kind) {
    case "draw":
    case "takeFirstDiscard":
    case "takeDiscard":
      return true;
    case "layDown":
      return Array.isArray(m.combos) && m.combos.length > 0 && m.combos.every(strs);
    case "add":
      return str(m.comboId) && strs(m.cardIds) && (m.side === "start" || m.side === "end");
    case "swapJoker":
      return str(m.comboId) && str(m.cardId);
    case "discard":
      return str(m.cardId);
    default:
      return false;
  }
}

export type View = ReturnType<TableRoom["viewFor"]>;

/** One party: lobby, then a match of rounds until one player or team is left (R-29). */
export class TableRoom extends Room {
  static turnMs = TURN_SECONDS * 1000; // R-12

  static async onAuth(token: string) {
    return { userId: await verifyToken(token) };
  }

  status: "lobby" | "playing" | "finished" = "lobby";
  playerCount = 2;
  companion = false;
  target = DEFAULT_TARGET;
  /** Join order; seats[0] is the creator while in the lobby (F2). */
  seats: Seat[] = [];
  round: RoundState | null = null;
  /** Per seat, or per team in companion mode (R-28). */
  totals: number[] = [];
  forfeited: boolean[] = [];
  roundLog: RoundLog[] = [];
  winner: number | null = null;
  deadline = 0;
  startedAt = "";
  createdBy = "";
  timer: Delayed | undefined;

  async onCreate(o: Options) {
    const { players, companion = false, target = DEFAULT_TARGET } = o;
    if (!Number.isInteger(players) || players < 2 || players > 4) throw new RuleError("R-01", "a table has 2 to 4 players");
    if (typeof companion !== "boolean" || (companion && players !== 4)) throw new RuleError("R-05", "companion mode needs 4 players");
    if (!Number.isInteger(target) || target < 1) throw new RuleError("R-29", "the target score must be a positive whole number");
    Object.assign(this, { playerCount: players, companion, target, maxClients: players });
    this.roomId = newCode();
    await this.setPrivate(true); // joined by code only, no public lobby

    this.onMessage("move", (client, move: unknown) => this.onMove(client, move));
  }

  onJoin(client: Client) {
    const { userId } = client.auth as { userId: string };
    const seat = this.seats.find((s) => s.userId === userId);
    if (seat) {
      // F5: same account, back in its seat. The turn deadline was never paused.
      const old = seat.client;
      seat.client = client;
      old?.leave();
    } else if (this.status !== "lobby") {
      throw new Error("this game has already started");
    } else {
      this.seats.push({ userId, client });
    }
    if (this.status === "lobby" && this.seats.length === this.playerCount) this.startMatch();
    else this.sendViews();
  }

  onLeave(client: Client) {
    const i = this.seats.findIndex((s) => s.client === client);
    if (i < 0) return;
    if (this.status === "lobby") this.seats.splice(i, 1); // the next joiner becomes seats[0], the creator
    else this.seats[i]!.client = null; // keep the seat for a reconnect
    this.sendViews();
  }

  onDispose() {
    this.timer?.clear();
  }

  onMove(client: Client, move: unknown) {
    const seat = this.seats.findIndex((s) => s.client === client);
    let next: RoundState;
    try {
      if (this.status !== "playing" || !this.round) throw new RuleError("TURN", "the game is not running");
      if (!isMove(move)) throw new RuleError("BAD_MOVE", "malformed move");
      next = applyMove(this.round, seat, move); // throws before touching this.round
    } catch (e) {
      if (!(e instanceof RuleError)) console.error("move failed", e);
      client.send("rejected", { rule: e instanceof RuleError ? e.rule : "BAD_MOVE", message: (e as Error).message });
      return;
    }
    this.advance(next);
  }

  /** R-25, R-26: the engine auto-plays or forfeits the active player. */
  onTimeout() {
    if (this.status !== "playing" || !this.round) return;
    this.advance(applyMove(this.round, this.round.activeSeat, { kind: "timeout" }));
  }

  private advance(next: RoundState) {
    const turnChanged = next.activeSeat !== this.round!.activeSeat;
    this.round = next;
    if (next.phase === "over") this.endRound();
    else if (turnChanged) this.startTurn();
    else this.sendViews();
  }

  startTurn() {
    this.timer?.clear();
    this.deadline = Date.now() + TableRoom.turnMs;
    this.timer = this.clock.setTimeout(() => this.onTimeout(), TableRoom.turnMs);
    this.sendViews();
  }

  private startMatch() {
    this.status = "playing";
    this.startedAt = new Date().toISOString();
    this.createdBy = this.seats[0]!.userId;
    this.totals = Array(this.companion ? 2 : this.playerCount).fill(0);
    this.forfeited = Array(this.playerCount).fill(false);
    this.dealRound(randomSeat(this.playerCount)); // R-04
  }

  private unit = (seat: number) => (this.companion ? seat % 2 : seat);
  private out = (seat: number) => this.forfeited[seat]! || isEliminated(this.totals[this.unit(seat)]!, this.target);

  private dealRound(shuffler: number) {
    const forfeited = this.seats.flatMap((_, seat) => (this.out(seat) ? [seat] : []));
    this.round = startRound({ playerCount: this.playerCount, shuffler, companion: this.companion, forfeited });
    this.startTurn();
  }

  private endRound() {
    const r = this.round!;
    const perSeat = roundPenalties(r); // R-27
    (this.companion ? teamPenalties(r) : perSeat).forEach((p, i) => (this.totals[i]! += p)); // R-28
    r.players.forEach((p) => p.forfeited && (this.forfeited[p.seat] = true));
    this.roundLog.push({
      round_number: this.roundLog.length + 1,
      starter_seat: r.shuffler,
      winner_seat: r.winner!,
      scores: r.players.map((p) => ({
        profile_id: this.seats[p.seat]!.userId,
        penalty: perSeat[p.seat]!,
        opened: p.opened,
        opening_total: p.openingTotal,
      })),
    });

    const units = this.totals.map((_, u) => this.seats.flatMap((_, seat) => (this.unit(seat) === u ? [seat] : [])));
    const winner = gameWinner(this.totals, units.map((seats) => seats.every((s) => this.forfeited[s])), this.target); // R-29
    if (winner !== null) return this.finish(winner);

    let shuffler = r.shuffler; // R-04: the next seat still at the table
    do shuffler = (shuffler + 1) % this.playerCount;
    while (this.out(shuffler));
    this.dealRound(shuffler);
  }

  private finish(winner: number) {
    this.timer?.clear();
    this.status = "finished";
    this.winner = winner;
    this.sendViews();

    const result: MatchResult = {
      party_code: this.roomId,
      mode: this.companion ? "companion" : "solo",
      player_count: this.playerCount,
      target_score: this.target,
      created_by: this.createdBy,
      started_at: this.startedAt,
      ended_at: new Date().toISOString(),
      winner_team_or_player: this.companion ? `team-${winner}` : this.seats[winner]!.userId,
      players: this.seats.map((s, seat) => ({
        profile_id: s.userId,
        seat,
        team: this.companion ? seat % 2 : null,
        final_score: this.totals[this.unit(seat)]!,
        forfeited: this.forfeited[seat]!,
      })),
      rounds: this.roundLog,
    };
    // Log the whole result on failure so it can be replayed by hand.
    saveMatch(result).catch((e) => console.error("match not saved", JSON.stringify(result), e));
  }

  private sendViews() {
    this.seats.forEach((s, seat) => s.client?.send("view", this.viewFor(seat)));
  }

  /** F3: public table state plus this seat's own hand. Never another hand or the draw pile. */
  viewFor(seat: number) {
    const r = this.round;
    return {
      code: this.roomId,
      status: this.status,
      you: seat,
      playerCount: this.playerCount,
      companion: this.companion,
      target: this.target,
      seats: this.seats.map((s) => ({ userId: s.userId, connected: s.client !== null })),
      totals: this.totals,
      winner: this.winner,
      hand: r?.players[seat]?.hand ?? [],
      table: r && {
        activeSeat: r.activeSeat,
        phase: r.phase,
        turn: r.turn,
        turnMsLeft: Math.max(0, this.deadline - Date.now()), // relative, so phone clock skew doesn't matter
        drawCount: r.drawPile.length,
        discardPile: r.discardPile,
        firstDiscard: r.firstDiscard,
        combinations: r.combinations,
        openingThreshold: r.openingThreshold,
        players: r.players.map((p) => ({
          seat: p.seat,
          handCount: p.hand.length,
          opened: p.opened,
          openingTotal: p.openingTotal,
          missedTurns: p.missedTurns,
          forfeited: p.forfeited,
        })),
      },
    };
  }
}
