# 犯人は踊る

The browser uses the authenticated `/api/criminal-dances` endpoint. The route
validates the bearer token and room membership, runs the shared rules, and
commits through service-role-only Supabase RPCs:

- `criminal_dances_commit_initial` — host-only, epoch and roster checked.
- `criminal_dances_read_state` — member-checked private state read.
- `criminal_dances_commit_action` — row lock, match/revision/seat checks and
  action-id replay protection.

The private table is never exposed to browser clients directly.

`rules.ts` is the shared contract for deck construction, effect transitions,
simultaneous exchanges, outcomes, and public/private projections. The SQL
implementation must preserve the `turnOrder` array exactly from initialization
through `playing` and `finished`; returning to the lobby starts a fresh match.

The public room state contains only seat order, hand counts, played card types,
last public action, pending operation metadata, and the final result. The
private table is the only source for hands and temporary reveal data.


The play screen keeps the latest public action, incident text, full played-card history, and card-effect explanations visible in compact expandable sections. Pending trade recipients and simultaneous selectors receive an explicit actionable prompt.

## 導入

1. `supabase/migrations/20261003000000_add_criminal_dances.sql` を既存マイグレーションの後に適用してください。
2. サーバーに `SUPABASE_SERVICE_ROLE_KEY`、ブラウザ・サーバーに既存の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。サービスキーはブラウザへ公開しません。
3. 通常のルームの Realtime 設定を利用します。`private` スキーマのAPI公開や秘密テーブルの Realtime 配信設定は不要です。

ゲーム一覧から3〜8人で開始できます。ホストの「ゲームを中断してロビーへ戻る」、または結果画面の「再戦する」で秘密状態を削除し、次の開始時に新規配札します。

## 検証

- `npx vitest run --maxWorkers=1`（PGliteの並列メモリ競合を避ける）
- `npm run typecheck`
- `npm run lint`
- `npx next build --webpack`（実行環境でTurbopackのポート生成が制限される場合）

ルールテストは固定手札による境界条件と3〜8人×12試合の完走・カード保存を検証します。APIテストは認証・秘匿・古い操作・再送を、PGliteテストはSQLの権限・競合・終了後拒否・リセットを検証します。実サービスへのマイグレーション適用と、複数の実ブラウザによるSupabase Realtime動作確認は別途必要です。
