import { defineRoom, defineServer } from "@colyseus/core";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { TURN_SECONDS, type Card } from "@rami/rules";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setKeys } from "./auth";
import { TableRoom, type View } from "./room";
import { saveMatch } from "./save";

vi.mock("./save", () => ({ saveMatch: vi.fn(async () => {}) }));

const SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_URL = SUPABASE_URL;

const { publicKey, privateKey } = await generateKeyPair("ES256");
setKeys(createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: "ES256" }] }));

const token = (sub: string, key: CryptoKey = privateKey, exp: number | string = "1h", user_metadata: object = {}) =>
  new SignJWT({ user_metadata })
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(sub)
    .setIssuer(`${SUPABASE_URL}/auth/v1`)
    .setAudience("authenticated")
    .setExpirationTime(exp)
    .sign(key);

/** A card id that can't clash with the dealt deck. */
const card = (code: string): Card => ({
  id: `t${code}`,
  rank: code.slice(0, -1) as Card["rank"],
  suit: code.slice(-1) as Card["suit"],
  deck: 1,
});

let colyseus: ColyseusTestServer;
beforeAll(async () => {
  colyseus = await boot(defineServer({ rooms: { table: defineRoom(TableRoom) } }));
});
afterEach(async () => {
  TableRoom.turnMs = TURN_SECONDS * 1000;
  vi.mocked(saveMatch).mockClear();
  await colyseus.cleanup();
});
afterAll(() => colyseus.shutdown());

type Player = Awaited<ReturnType<typeof join>>;

async function join(user: string, code?: string, options: object = { players: 2 }) {
  colyseus.sdk.auth.token = await token(user);
  const room = code ? await colyseus.sdk.joinById(code) : await colyseus.sdk.create("table", options);
  const me = { room, view: null as View | null, rejected: [] as string[] };
  room.onMessage("view", (v: View) => (me.view = v));
  room.onMessage("rejected", (r: { rule: string }) => me.rejected.push(r.rule));
  return me;
}

async function table(players: number) {
  const host = await join("u0", undefined, { players });
  const clients: Player[] = [host];
  for (let i = 1; i < players; i++) clients.push(await join(`u${i}`, host.room.roomId));
  const server = colyseus.getRoomById<TableRoom>(host.room.roomId);
  await vi.waitFor(() => expect(server.status).toBe("playing"));
  return { server, clients, code: host.room.roomId };
}

/** Puts `seat` one turn from going out: draw 5H, add it to their 2-3-4H Serie, discard 9C. */
function setUpWin(server: TableRoom, seat: number) {
  const r = server.round!;
  const p = r.players[seat]!;
  r.activeSeat = seat;
  r.phase = "draw";
  r.turn = { drew: null, takenCardId: null, jokerToPlace: null };
  r.drawPile.push(card("5H"));
  r.combinations = [{ id: "c0", type: "SERIE", cards: [card("2H"), card("3H"), card("4H")], ownerSeat: seat }];
  Object.assign(p, { opened: true, openingTotal: 72, turnsTaken: 1, hand: [card("9C")] });
}

function goOut(player: Player) {
  player.room.send("move", { kind: "draw" });
  player.room.send("move", { kind: "add", comboId: "c0", cardIds: ["t5H"], side: "end" });
  player.room.send("move", { kind: "discard", cardId: "t9C" });
}

describe("login (F1)", () => {
  it("F1 a connection without a valid Supabase token is rejected", async () => {
    colyseus.sdk.auth.token = "";
    await expect(colyseus.sdk.create("table", { players: 2 })).rejects.toThrow();

    const stranger = await generateKeyPair("ES256");
    colyseus.sdk.auth.token = await token("u0", stranger.privateKey);
    await expect(colyseus.sdk.create("table", { players: 2 })).rejects.toThrow();

    colyseus.sdk.auth.token = await token("u0", privateKey, Math.floor(Date.now() / 1000) - 60);
    await expect(colyseus.sdk.create("table", { players: 2 })).rejects.toThrow();
  });
});

describe("parties (F2)", () => {
  it("F2 R-01 party options are checked", async () => {
    for (const options of [{ players: 5 }, { players: 1 }, { players: 3, companion: true }, { players: 2, target: 0 }]) {
      colyseus.sdk.auth.token = await token("u0");
      await expect(colyseus.sdk.create("table", options)).rejects.toThrow();
    }
  });

  it("F2 a party gets a short random code and starts when the seats are full", async () => {
    const host = await join("u0", undefined, { players: 3 });
    const code = host.room.roomId;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const server = colyseus.getRoomById<TableRoom>(code);

    await join("u1", code);
    expect(server.status).toBe("lobby");
    await join("u2", code);
    await vi.waitFor(() => expect(server.status).toBe("playing"));

    const r = server.round!;
    expect(r.players.map((p) => p.hand.length)).toEqual([0, 1, 2].map((s) => (s === r.shuffler ? 15 : 14)));
    // R-12: the turn timer is 15 seconds.
    expect(server.deadline - Date.now()).toBeGreaterThan(TURN_SECONDS * 1000 - 1000);
  });

  it("F1 the view shows each player's name and photo from the social login", async () => {
    colyseus.sdk.auth.token = await token("u0", privateKey, "1h", { full_name: "Amina", avatar_url: "https://x/a.png" });
    const room = await colyseus.sdk.create("table", { players: 2 });
    const views: View[] = [];
    room.onMessage("view", (v: View) => views.push(v));
    await vi.waitFor(() => expect(views.at(-1)?.seats[0]).toMatchObject({ name: "Amina", avatar: "https://x/a.png" }));
  });

  it("F2 an unknown code cannot be joined", async () => {
    colyseus.sdk.auth.token = await token("u1");
    await expect(colyseus.sdk.joinById("ZZZZZZ")).rejects.toThrow();
  });

  it("F2 if the creator leaves the lobby the next player becomes creator", async () => {
    const host = await join("u0", undefined, { players: 3 });
    const code = host.room.roomId;
    await join("u1", code);
    const server = colyseus.getRoomById<TableRoom>(code);
    await host.room.leave();
    await vi.waitFor(() => expect(server.seats.map((s) => s.userId)).toEqual(["u1"]));
  });

  it("F2 F5 a seat in a started game belongs to its account", async () => {
    const { clients, code, server } = await table(2);
    await clients[1]!.room.leave();
    await vi.waitFor(() => expect(server.seats[1]!.client).toBeNull());
    colyseus.sdk.auth.token = await token("u9");
    await expect(colyseus.sdk.joinById(code)).rejects.toThrow();
  });
});

describe("moves (F3)", () => {
  it("F3 each player only sees their own hand", async () => {
    const { server, clients } = await table(2);
    const r = server.round!;
    clients[r.shuffler]!.room.send("move", { kind: "discard", cardId: r.players[r.shuffler]!.hand[0]!.id });
    await vi.waitFor(() => expect(clients[0]!.view?.table?.activeSeat).toBe(server.round!.activeSeat));

    const view = JSON.stringify(clients[0]!.view);
    expect(clients[0]!.view!.hand.map((c) => c.id)).toEqual(server.round!.players[0]!.hand.map((c) => c.id));
    for (const c of [...server.round!.players[1]!.hand, ...server.round!.drawPile]) {
      expect(view).not.toContain(`"id":"${c.id}"`);
    }
  });

  it("F3 an illegal move is rejected with a reason code and the table is unchanged", async () => {
    const { server, clients } = await table(2);
    const before = server.round;
    const active = clients[before!.activeSeat]!;
    const waiting = clients[1 - before!.activeSeat]!;

    waiting.room.send("move", { kind: "draw" });
    active.room.send("move", { kind: "layDown", combos: [[before!.players[before!.activeSeat]!.hand[0]!.id]] });
    active.room.send("move", { kind: "timeout" }); // only the server may time a player out
    active.room.send("move", { kind: "add", comboId: "c0", cardIds: 5, side: "end" });

    await vi.waitFor(() => expect(active.rejected).toEqual(["R-03a", "BAD_MOVE", "BAD_MOVE"]));
    expect(waiting.rejected).toEqual(["TURN"]);
    expect(server.round).toBe(before);
  });
});

describe("timer (F4)", () => {
  it("R-25 when the timer runs out the server draws and discards for the player", async () => {
    const { server } = await table(2);
    const shortTurn = () => {
      TableRoom.turnMs = 50;
      server.startTurn(); // re-arm the current turn on a short timer; the next turn gets a long one
      TableRoom.turnMs = 60_000;
    };
    const first = server.round!.activeSeat;
    shortTurn();
    await vi.waitFor(() => expect(server.round!.activeSeat).not.toBe(first));
    expect(server.round!.firstDiscard).not.toBeNull(); // the shuffler only discards (R-03a)

    const second = server.round!.activeSeat;
    const pile = server.round!.drawPile.length;
    shortTurn();
    await vi.waitFor(() => expect(server.round!.activeSeat).toBe(first));
    const p = server.round!.players[second]!;
    expect(p.missedTurns).toBe(1);
    expect(p.hand).toHaveLength(14);
    expect(server.round!.drawPile).toHaveLength(pile - 1);
    expect(server.round!.discardPile).toHaveLength(2); // R-03a: the first discard went under the pile
  });

  it("R-26 three timeouts in a row remove a player, the others play on, the last one wins", async () => {
    const { server } = await table(3);
    const s = server.round!.shuffler;
    for (let i = 0; i < 7; i++) server.onTimeout(); // s, s+1, s+2, s, s+1, s+2, s

    expect(server.round!.players[s]!.forfeited).toBe(true);
    expect(server.status).toBe("playing");
    expect(server.round!.activeSeat).not.toBe(s);

    server.onTimeout(); // s+1 times out a third time, s+2 is the only one left
    expect(server.status).toBe("finished");
    expect(server.winner).toBe((s + 2) % 3);
    expect(vi.mocked(saveMatch)).toHaveBeenCalledOnce();
    const saved = vi.mocked(saveMatch).mock.calls[0]![0];
    expect(saved.players.filter((p) => p.forfeited).map((p) => p.seat).sort()).toEqual([s, (s + 1) % 3].sort());
  });
});

describe("reconnect (F5)", () => {
  it("F5 a player who drops rejoins from the same account with their hand and the running timer", async () => {
    const { server, clients, code } = await table(2);
    const hand = server.round!.players[1]!.hand.map((c) => c.id);
    const deadline = server.deadline;
    const leftBefore = deadline - Date.now();

    await clients[1]!.room.leave(false);
    await vi.waitFor(() => expect(server.seats[1]!.client).toBeNull());
    expect(server.status).toBe("playing");

    const back = await join("u1", code);
    await vi.waitFor(() => expect(back.view).not.toBeNull());
    expect(back.view!.you).toBe(1);
    expect(back.view!.hand.map((c) => c.id)).toEqual(hand);
    expect(server.deadline).toBe(deadline); // time spent offline still counts
    expect(back.view!.table!.turnMsLeft).toBeLessThanOrEqual(leftBefore);
  });
});

describe("full game", () => {
  it("R-23 R-27 R-29 rounds are scored, the shuffler rotates, and the finished match is saved", async () => {
    const { server, clients, code } = await table(3);
    const firstShuffler = server.round!.shuffler;

    setUpWin(server, 0);
    goOut(clients[0]!);
    await vi.waitFor(() => expect(server.roundLog).toHaveLength(1));
    expect(server.totals).toEqual([0, 100, 100]); // R-27: never opened
    expect(server.round!.shuffler).toBe((firstShuffler + 1) % 3); // R-04
    expect(server.status).toBe("playing");

    server.totals = [0, 450, 450];
    setUpWin(server, 0);
    goOut(clients[0]!);
    await vi.waitFor(() => expect(server.status).toBe("finished"));
    expect(server.winner).toBe(0);
    await vi.waitFor(() => expect(clients[1]!.view?.status).toBe("finished"));

    expect(vi.mocked(saveMatch)).toHaveBeenCalledOnce();
    const saved = vi.mocked(saveMatch).mock.calls[0]![0];
    expect(saved).toMatchObject({
      party_code: code,
      mode: "solo",
      player_count: 3,
      target_score: 501,
      created_by: "u0",
      winner_team_or_player: "u0",
    });
    expect(saved.players.map((p) => p.final_score)).toEqual([0, 550, 550]);
    expect(saved.rounds.map((r) => r.winner_seat)).toEqual([0, 0]);
    expect(saved.rounds[0]!.scores[1]).toMatchObject({ profile_id: "u1", penalty: 100, opened: false });
  });
});
