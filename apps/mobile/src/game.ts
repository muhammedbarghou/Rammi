import { Client, type Room } from "@colyseus/sdk";
import type { Move } from "@rami/rules";
import type { View } from "../../server/src/room";
import { SERVER_URL, supabase } from "./supabase";

export type { View };
export type Table = NonNullable<View["table"]>;
export type PartyOptions = { players: number; companion: boolean; target: number };

const client = new Client(SERVER_URL);

/** Creates a party, or joins one by code. The server checks the Supabase JWT (F1). */
export async function connect(how: { create: PartyOptions } | { code: string }): Promise<Room> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("sign in first");
  client.auth.token = data.session.access_token;
  return "code" in how ? client.joinById(how.code.trim().toUpperCase()) : client.create("table", how.create);
}

export const sendMove = (room: Room, move: Move) => room.send("move", move);
