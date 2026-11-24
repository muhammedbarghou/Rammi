# Moroccan Rami (Talaj 71)

Real-time multiplayer card game for iOS and Android. Real players only, no bots.

## Source of truth
- `docs/PRD.md` defines every game rule (R-01 to R-29) and every feature.
- Never invent, change or "improve" a rule. If the PRD is unclear or two rules conflict, stop and ask.

## Structure
- `packages/rules`: all game logic. Pure TypeScript, no network, no UI. Used by both server and app.
- `apps/server`: Colyseus game server (live rooms, timers, reconnect).
- `apps/mobile`: Expo (React Native) app, landscape only.
- `supabase/`: migrations. Supabase handles Google/Apple sign-in and Postgres. It does not run live games.

## Architecture rules
- The server is authoritative. It validates every move. The client never decides outcomes.
- Hands and the draw pile never leave the server. Clients get only their own hand and public table state.
- Rule logic lives only in `packages/rules`. The server and the app call it, never copy it.
- The server checks the Supabase JWT on every connection.

## Code rules
- TypeScript strict mode. No `any`.
- Everything runs through Docker (server and local services).
- Name each test after its rule number, for example `R-17 opening needs a Tria and a Serie`.
- Write the tests first. Run the full test suite before every commit.
- One commit per rule group. Short messages, imperative mood.

## Product rules
- Game terms are never translated: Talaj, Tria (or trio), Serie (or suivi).
- Languages: Arabic (RTL), French, English. English is the default.
- Version 1 adds cards to the table by tapping. No drag and drop, no animations yet.
- Not in version 1: coins and betting, cosmetics, friends and invites, free-text chat, public lobby, ranked matchmaking.

## Workflow
- Work on one PRD phase at a time (section 11). Do not start the next phase unprompted.
- Before big changes, say what you plan to do in a few lines.