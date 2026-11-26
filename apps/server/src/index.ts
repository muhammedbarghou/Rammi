import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { TableRoom } from "./room";

for (const name of ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[name]) throw new Error(`${name} is not set`);
}

defineServer({
  transport: new WebSocketTransport(),
  rooms: { table: defineRoom(TableRoom) },
}).listen(Number(process.env.PORT ?? 2567));
