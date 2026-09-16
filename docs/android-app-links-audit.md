# Android App Links 監査と再生成・実機テスト手順

更新日: 2026-09-16

対象 URL は `https://stanparty.katsudon.app/room/{roomId}` です。結論から言うと、配布物にはこのホスト全体を受ける `https` App Links フィルタがあり、`autoVerify=true` も設定されています。`roomId` の path と query を TWA がそのまま扱える設計上の根拠もあります。実機での cold/warm の表示確認は、この環境に Android 端末がないため未実施です。下記の手順で実機確認してください。

今回の変更はこの手順書のみです。Web 側の本番反映と App Links のための AAB 再提出は、現在の確認範囲では不要です。Android ソースがないためビルドは未実施です。未起動・起動中それぞれの遷移と query 保持、未インストール時のプレイ、Play 内部テストと LINE 経由は未検証です。

## 追加確認: Galaxy S21 の実機結果

ユーザー提供の adb 出力から、インストール版の署名は登録済みの旧 Play 鍵（末尾 `:C6:E8`）と一致しています。最初のドメイン検証状態は `1024` で、手動選択が Enabled の状態ではリンクが開いたとの報告がありました。`pm verify-app-links --re-verify` 実行後は次の状態になりました。

```text
Domain verification state:
  stanparty.katsudon.app: verified
Verification link handling allowed: true
Selection state:
  Disabled:
    stanparty.katsudon.app
```

これはドメイン検証成功です。`Selection state` は手動選択の一覧であり、そこにある `Disabled` だけを根拠に、検証済みドメインの起動も禁止されていると判断してはいけません。Android はリンク処理の許可を確認した後、検証済みドメインを手動選択より優先して判定します。以前の「この状態では手動でオンに戻す必要がある」という案内は誤りです。[Android の判定実装](https://android.googlesource.com/platform/frameworks/base/+/master/services/core/java/com/android/server/pm/verify/domain/DomainVerificationService.java)

新規インストール時は既存の `autoVerify=true` により Android が非同期で検証を行います。成功すればユーザーによるドメイン選択は不要です。今回の再検証成功は初回インストール時の成功を実証したものではなく、元の `1024` の原因も未確定です。[公式検証手順](https://developer.android.com/training/app-links/verify-applinks)

次は現在の設定を変更せず、実在する招待 URL を通常の外部リンクとして開いて確認します。新規ユーザー相当の確認には、過去の設定を引き継いでいない別端末などで Play 内部テスト版を新規インストールし、ネット接続したまま数分待ち、手動選択・adb による再検証を行う前に `verified` とリンク起動を確認します。LINE 内ブラウザでの表示は別途確認します。

## 1. 監査対象と取り扱い

Downloads にある次の 2 ZIP を対象にしました。

* `StanParty - Google Play package.zip`
* `StanParty - Google Play package (1).zip`

両 ZIP はそれぞれ 6 エントリだけを含み、アプリのソースコードはありません。APK と AAB だけを `unzip -p` で `/tmp/stanparty-android-audit.UCgHAp/` にコピーして読み取り専用で調べました。keystore と key-info の内容は読み出していません。

コピーした成果物の SHA-256 は次の通りです。2 ZIP 間で同じ値でした。

```text
APK  8ae561de94bf7c666a458d10fd167c59f525ef7cc5a4ce29dad9234721d83858
AAB  f747613e6a43cc72156b4de164ac0c21b975240b0f6bb6b544b26de0f488728a
```

`public/.well-known/assetlinks.json` は変更していません。リポジトリにある 4 fingerprint の値は、root の実行済み production 確認（HTTP 200、リダイレクトなし、JSON の 4 値が local と一致）を引き継ぎます。署名証明書を変えた再生成時だけ、Play App Signing 証明書の値と照合してください。

## 2. APK/AAB から確認できた事実

### Manifest

APK の binary `AndroidManifest.xml` をデコードして確認した値です。AAB には同じ base module の manifest と classes.dex が含まれます。

| 項目 | 確認値 |
| --- | --- |
| package | `app.katsudon.stanparty` |
| versionCode | `1` |
| versionName | `1.0.0.0` |
| minSdk | `23` |
| targetSdk | `36` |
| Launcher activity | `app.katsudon.stanparty.LauncherActivity` |
| exported | `true` |
| launchMode | 属性なし（Android の既定値 `standard`） |
| TWA の既定 URL | `https://stanparty.katsudon.app/`（resource 解決値） |
| web manifest URL | `https://stanparty.katsudon.app/manifest.webmanifest` |

`LauncherActivity` には次の 2 つの intent-filter があります。

* `MAIN` + `LAUNCHER`
* `VIEW` + `DEFAULT` + `BROWSABLE`、`android:autoVerify="true"`、`scheme="https"`、host は `stanparty.katsudon.app`

path の指定はありません。このため検証が成功した場合、同一ホストの `/room/*` を含む HTTPS URL 全体が候補になります。`http` の data は manifest にありません。

`classes.dex` のパッケージには `com.google.androidbrowserhelper.trusted.*` が含まれ、AAB の `dependencies.pb` には次の依存が記録されています。

```text
com.google.androidbrowserhelper:androidbrowserhelper:2.6.2
androidx.browser:browser:1.9.0-alpha04
```

APK に含まれる `web_app_manifest.json` は `start_url: "/app"`、`scope: "/"`、`display: "standalone"` です。これは Web App Manifest の start URL であり、APK manifest の `android.support.customtabs.trusted.DEFAULT_URL`（今回の resource 解決値は `https://stanparty.katsudon.app/`）や、HTTPS VIEW intent で渡された room URL を置き換える指定ではありません。

### URI の cold/warm 処理

配布物には Android の Java/Kotlin ソースがないため、`app.katsudon.stanparty.LauncherActivity` の生成サブクラスをソースとしてレビューすることはできません。確認できたのは manifest、classes.dex のクラス名・文字列・メソッド本体、ProGuard map、依存メタデータです。

ProGuard map には生成サブクラスの `onCreate(Bundle)` と `getLaunchingUrl()` が記録されています。classes.dex の当該 `getLaunchingUrl()`（R8 後の名前 `i`）は、5 code unit の本体で親の `LauncherActivity.i()` を invoke-super し、結果を返すだけでした。生成側で path/query を `/app` などへ書き換える命令は確認できません。`onNewIntent` の記録はありませんが、R8 の mapping の出方だけで override 不在を証明する必要はなく、URI の選択は親 helper の `getLaunchingUrl()` に委譲されています。

ただし、同じバージョンの公式 Android Browser Helper の `LauncherActivity` ソースには、次の処理があります。

* `onCreate()` は `getIntent().getData()` を見て TWA を起動する。
* `https` の data URI は `getLaunchingUrl()` がそのまま返す。path、query を再構成する処理はない。
* `launchTwa()` は選んだ URL で `TrustedWebActivityIntentBuilder` を構築し、ブラウザ側の TWA に渡す。
* TWA が既に動いているとき、data のある新しい BROWSABLE intent は再ナビゲーションの対象として処理される。data のないランチャー起動だけは既存 TWA を再起動せず終了する。
* `singleTask` に頼らず、新しい LauncherActivity を TWA への trampoline として扱い、ブラウザ側の既存 task に戻す設計である。

したがって、manifest と公式 helper の実装からは、次の期待になります。

* cold: app wrapper が停止中に room URL を implicit VIEW で送ると、公式 helper の既定処理では `/room/{id}?…` が TWA に渡る。
* warm: TWA が表示中に別 room URL を implicit VIEW で送ると、公式 helper の既定処理では別の LauncherActivity が trampoline として起動し、既存 TWA の URL が別 room に変わる。
* ランチャーアイコンからの通常起動は intent data がないため、APK manifest の既定 URL `/` になる。Web App Manifest の `start_url=/app` は別の設定である。

これは TWA 親 helper と生成 `getLaunchingUrl()` の DEX 本体から得た静的結果であり、端末上の画面遷移は実測していません。特に Chrome の task 状態、既定ブラウザ、ユーザーが選んだドメイン設定によって見え方が変わるので、4 節の cold/warm テストを合格条件にします。

### ブラウザ fallback

Manifest の fallback metadata は `customtabs` です。TWA provider がない、または TWA 起動が失敗した場合は Android Browser Helper の Custom Tabs fallback が選ばれます。`http` URL、未検証 host、アプリ未インストール時は Android App Links の検証済み候補にならず、ブラウザ（またはユーザーの chooser）に解決されます。

アプリがインストールされていても、App Links のユーザー許可を無効にすれば browser 側の挙動になります。端末の Chrome データ消去や個人端末でのアンインストールはテストに使わないでください。

## 3. Android 12+ のドメイン検証

実機をネットワークに接続し、Play からインストールした package で実行します。

```bash
PKG=app.katsudon.stanparty

# 端末上の前回状態をリセット
adb shell pm set-app-links --package "$PKG" 0 all

# assetlinks.json を再取得して再検証
adb shell pm verify-app-links --re-verify "$PKG"

# 数分待ってから結果を確認
adb shell pm get-app-links --user cur "$PKG"
```

期待値は対象ドメインについて `verified` です。`none` はまだ検証中の可能性があります。`legacy_failure` や数値状態なら、production の次を確認してから再検証します。

```bash
curl -i https://stanparty.katsudon.app/.well-known/assetlinks.json
curl -fsS https://stanparty.katsudon.app/.well-known/assetlinks.json | jq .
```

リダイレクト、TLS エラー、JSON の構文エラー、package 名の不一致、Play App Signing 証明書 fingerprint の不足を確認します。`assetlinks.json` を開発 APK の証明書だけで上書きしないでください。

## 4. 実機での cold/warm path + query テスト

まず production 上で、実在する 2 つの room を作成します。以下は PC 側の Bash で実行します。`ROOM_A` と `ROOM_B` はその実際の room ID に置き換えてください。URL 内の `&` が端末のシェルに解釈されないよう、`-d` の二重引用符内にも単一引用符を付けています。query の `%E3...` は「テスト」、`%2B` は literal `+` の encoded 表現です。

```bash
PKG=app.katsudon.stanparty
ROOM_A='実在する room A の ID'
ROOM_B='実在する room B の ID'
URL_A="https://stanparty.katsudon.app/room/${ROOM_A}?from=line&memo=%E3%83%86%E3%82%B9%E3%83%88%2Broom-a"
URL_B="https://stanparty.katsudon.app/room/${ROOM_B}?from=line&memo=%E3%83%86%E3%82%B9%E3%83%88%2Broom-b"

# cold wrapper: app package だけを停止する。Chrome の force-stop/データ消去はしない。
adb shell am force-stop "$PKG"
adb shell am start -W \
  -a android.intent.action.VIEW \
  -c android.intent.category.DEFAULT \
  -c android.intent.category.BROWSABLE \
  -d "'$URL_A'"
adb logcat -d -v brief -s TWALauncherActivity:D
```

cold 合格条件は、ブラウザの TWA 画面が room A を表示し、URL の path が `/room/${ROOM_A}`、query の `from` が `line`、`memo` が文字列 `テスト+room-a`（プラス文字を含む）になることです。さらに受信 URL の生文字列を確認し、パスとエンコード済み query が元の URL と一致することを確認します。logcat が有効なら `Using url from Intent: ...` も確認できます。production の room 画面が query を UI に表示しない場合は、画面だけで query の保持を断定せず、Chrome の開発者ツール・アクセスログ、または TWA が受け取った URL の観測手段を併用してください。

次に TWA を表示したまま、同じ implicit VIEW を別 room に送ります。

```bash
adb shell am start -W \
  -a android.intent.action.VIEW \
  -c android.intent.category.DEFAULT \
  -c android.intent.category.BROWSABLE \
  -d "'$URL_B'"
adb logcat -d -v brief -s TWALauncherActivity:D
adb shell dumpsys activity activities | rg -i 'mResumedActivity|topResumedActivity|stanparty|chrome'
```

warm 合格条件は、既存 TWA が room B に遷移し、path/query が B の値になることです。Chrome/TWA task が増えないことは補助的な観測項目として記録します。`am start` に `-n` や `-p` を付けないでください。package を強制指定すると Android の App Links routing 自体を検証できません。

「cold」はこの手順では wrapper package の停止を意味します。Chrome が別タスクで生きている状態まで含む完全なプロセス cold を作るために、Chrome を force-stop、データ消去、アンインストールする必要はありません。個人データを消さずに再現できない状態は、専用 emulator または別 Android user profile で確認します。

### browser fallback と未インストール時

最も安全なのは専用 emulator/別 user です。アプリを入れていない状態で、同じ `URL_A` を Chrome の通常ページまたは次の implicit VIEW で開きます。

```bash
adb shell am start -W \
  -a android.intent.action.VIEW \
  -c android.intent.category.DEFAULT \
  -c android.intent.category.BROWSABLE \
  -d "'$URL_A'"
```

アプリ未インストールなら web の room route が開くことが合格です。個人端末で `pm uninstall --user 0 app.katsudon.stanparty` を実行するとアプリデータが失われる可能性があるため、未インストール試験のためだけに実行しないでください。インストール済み端末では、設定の「デフォルトで開く」で supported links を一時的に無効にする方法を使い、試験後に元へ戻します。

### LINE 経由の確認

LINE のトークからタップした結果は Android App Links と同じではありません。LINE の in-app browser が URL を保持しているだけのことがあるため、次を別々に記録します。

1. LINE のトーク内リンクをタップした結果（LINE 内ブラウザか、外部ブラウザか）。
2. LINE の「外部ブラウザで開く」操作、または URL をコピーして Chrome へ渡した結果。
3. 上記 4 節の `adb shell am start` の結果。

3 が App Links の routing 証拠です。1 が LINE 内ブラウザになっても APK の App Links 不具合とは限りません。URL エンコード済み文字列を使い、リンク元が query を変更していないかも記録します。Chrome のアドレスバーへの貼り付けは通常のリンクタップと異なるので、アプリ起動の合否判定には使いません。

## 5. Google Play Internal test

実機 routing の最終確認は、sideload APK と Play 版を分けます。

* APK: 開発・manifest の素早い確認用。Play App Signing の本番証明書を代表しない場合があります。
* AAB: Play Console の Internal testing にアップロードして、テスターの Play URL からインストールする本番経路確認用。AAB を `adb install` するものではありません。

現配布物の versionCode は `1` です。変更した AAB を同じ Play listing に上げるときは、Play Console で過去に upload した最大 versionCode より大きくし、既存の署名鍵を安全なローカル入力から再利用します。鍵を ZIP やリポジトリへコピーせず、同じ署名運用を維持します。Play 版のインストール後に 3 節の検証、4 節の cold/warm、未インストール相当の browser fallback を行い、端末の package/version も記録します。

```bash
adb shell dumpsys package app.katsudon.stanparty | rg -i 'versionCode|versionName|enabled'
adb shell pm get-app-links --user cur app.katsudon.stanparty
```

## 6. 再生成手順と現時点の blocker

この ZIP には Android ソースがないため、今回の作業では APK/AAB を変更・再署名・再ビルドしていません。現在確認できる versionCode、署名、helper version を保ったままコード修正することはできません。

ソースを得て再生成する場合は次の順で行います。

1. PWABuilder の Android package generator で production origin `https://stanparty.katsudon.app` を入力し、`Include source code` を有効にする。既存の署名鍵を使う設定を選び、鍵・パスワードは手元の安全な入力画面から設定する（新しい鍵を作らず、秘密情報をログやリポジトリに残さない）。その後に生成する。PWABuilder の生成物は Bubblewrap/Trusted Web Activity を使うため、生成 ZIP に APK と AAB が含まれる仕様です。
2. package ID `app.katsudon.stanparty`、launcher name、Web Manifest の `start_url=/app` と Android の既定 URL `/` の違い、scope `/`、host、HTTPS App Links、`autoVerify`、fallback type を生成設定とソースで確認する。既存のホスト全体のフィルタを `/room/` だけへ狭めず、重複フィルタや不要な `singleTask`・`onNewIntent` override を追加しない。
3. 既存の Play 署名鍵を安全なローカル入力として再利用し、生成ソースを保存する。次回からはこのソース・Play Console で確認した最大 versionCode・署名運用を再現可能な入力として管理する。今後リンク受信の修正が必要になったら、生成された `LauncherActivity` の `getUrlForIntent`/`getLaunchingUrl` 周辺をソースでレビューしてから変更する。バイナリの patch はしない。
4. 新しい AAB/APK の manifest で package、version、`VIEW` filter、host、`autoVerify` を確認し、AAB の依存 version と署名 fingerprint を記録する。
5. 新しい Play App Signing 証明書になる場合だけ、`public/.well-known/assetlinks.json` と production の JSON にその fingerprint を追加してから 3 節を再実行する。既存の値を理由なく削除しない。
6. 4 節の room A/B テストを行い、cold/warm、browser fallback、LINE の 3 経路を記録する。Play 内部テスト版でも同じ確認を繰り返す。

参考にした一次資料:

* [Android Developers: Verify Android App Links](https://developer.android.com/training/app-links/verify-applinks)
* [Android Developers: Troubleshoot App Links](https://developer.android.com/training/app-links/troubleshoot)
* [Android Developers: About App Links](https://developer.android.com/training/app-links/about)
* [Android Browser Helper 2.6.2 `LauncherActivity.java`](https://github.com/GoogleChrome/android-browser-helper/blob/android-browser-helper-2.6.2/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/LauncherActivity.java)
* [Android Browser Helper 2.6.2 `TwaLauncher.java`](https://github.com/GoogleChrome/android-browser-helper/blob/android-browser-helper-2.6.2/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/TwaLauncher.java)
* [PWABuilder Google Play packaging README](https://github.com/pwa-builder/pwabuilder-google-play/blob/main/README.md)
