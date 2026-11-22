# あいうえバトル

2–8 players. Host selects a shared random candidate or a custom theme. Words
normalize katakana, voicing and small kana, preserve ー, and privately pad to
seven cells. First attack hit grants one extra attack only while the actor is
alive and more than one player remains. Second attacks always end the turn;
zero survivors draw.

## Server boundary

The browser calls `/api/aiue-battle` using its Supabase bearer token. The server
verifies the token via `auth.getUser`, derives the actor, checks room membership,
and returns only the public state plus that actor's `myCells`. Opponents always
have exactly seven null/revealed cells, including after the match. Secret words,
lengths and padding never enter room state, room events or shared projections.

Full game state lives in `private.aiue_battle_state`, inaccessible to anonymous
and authenticated database clients. Service-only RPCs lock rooms and private
state, compare match/epoch/revision, and deduplicate action IDs. The server reducer
owns every transition. Host clients cannot directly overwrite active room state,
seat order, match generation or game type. Host lobby reset clears secrets and
increments the epoch, invalidating in-flight initializers.

Word submissions use the same compare-and-swap boundary as attacks. If another
submission wins the race, the UI refreshes and preserves input/preview, showing a
retry message; the player confirms again. Reconnect, subscription changes,
visibility changes and online events refresh owner-scoped snapshots. Lower
revisions of the same match cannot replace newer local or shared snapshots.

## Rollout and checks

Apply `supabase/migrations/20261122000000_add_aiue_battle.sql` before enabling
this build. The server needs `SUPABASE_SERVICE_ROLE_KEY`, and the usual
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose the
service role key through a public environment variable. No extra publication is
needed: existing room updates notify clients. Private state is never published.

Run `npm test -- --maxWorkers=1`, `npm run typecheck`, `npm run lint`, and
`npm run build`. Tests cover reducer flows with two/eight players, normalization,
turn/endgame edge cases, API authentication/projection/action replay, PGlite
permissions/locks/CAS/reset contracts, SSR board privacy and snapshot ordering.
They do not replace real device or live multi-client Supabase Realtime checks.
