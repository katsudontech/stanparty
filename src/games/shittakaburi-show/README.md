# 知ったかぶりショー

3〜14人。全員が秘密の単語を1つ登録し、投稿者単位で未使用の投稿をランダムに選びます。同じ単語の投稿も別々に使用します。毎ラウンド全員の発表順をシャッフルし、出題者だけに役割を通知します。

対面や別の通話アプリで説明と質問を行い、ホストが投票へ進めます。出題者も含む全員が自分以外に投票します。投票先と票数を先に公開し、ホストの「出題者を発表」で正体・今回の得点内訳・累計順位を公開します。出題者は得票×1点、ほかの人は得票×2点＋出題者への正解投票1点。同点は同順位です。ホストは次のお題か途中終了を選択できます。最後の投稿の得点公開で自動的に最終結果へ進みます。ロビーに戻ると新しい投稿で再プレイできます。

## Deployment

Apply `supabase/migrations/20261123000000_add_shittakaburi_show.sql` after the existing migrations. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` as in `.env.example`. Never expose the service key with a `NEXT_PUBLIC_` prefix. The existing rooms Realtime publication is used for public revision notifications.

The Next.js `/api/shittakaburi-show` route verifies the Supabase bearer token with `auth.getUser`, checks room membership and derives actor/host identity on the server. Secret submissions, ownership, pending votes and action IDs live in `private.shittakaburi_show_state`, inaccessible to anon/authenticated clients. `rooms.game_state` and Realtime contain only an explicit public projection. Viewer snapshots reveal only the viewer's registration word during setup, role during discussion/voting, and own vote during voting. Vote results hide all role markers, author identity and scores until the host reveals the author. Early finish never publishes unused submissions.

Service-only RPCs lock room then private state in consistent order and commit with match ID/revision CAS. Submissions and votes retry revision conflicts up to 16 times, preserving match/round/phase guards. Saved action IDs make retries safe, including scoring and random selection. Initialization checks the room epoch and exact roster; returning to the lobby deletes private state and increments the epoch. Direct authenticated state/roster/game changes during play are rejected, including writes by the host. Round speaking order is independent of the immutable room roster.

## Limitations

There is no built-in voice chat, speech recording, dictionary lookup or meaning verification. A participant can always remember previously revealed information; the vote-results screen hides role markers but cannot erase that knowledge. The game waits for every original participant's submission/vote and does not skip disconnected players or transfer the host automatically. Reconnecting restores state; if a participant cannot return the host can reset to the lobby using the room controls. Game availability depends on the server-side Supabase credentials. Production deployment and browser-to-browser Realtime testing still require a configured Supabase project.

## Verification

`npm test -- --maxWorkers=1` includes rules, API concurrency/idempotency, phase rendering, and real PostgreSQL authority/CAS/reset checks using PGlite. Also run `npm run typecheck`, `npm run lint`, and `npm run build`.
