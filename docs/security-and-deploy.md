# セキュリティと公開の手順

Node.js 24.22.2 を利用する（`.node-version`）。eMudhra 対策を含む修正版に固定している。Cloudflare の旧 asdf インストール経路を避けるため、リポジトリに `.tool-versions` は置かない。

```sh
npm ci --ignore-scripts
npm run dev
npm run verify
```

`verify` は型チェック、コメント API の回帰テスト、ビルド、全依存関係の `npm audit` を行う。GitHub Actions は PR と main 更新時に同じ検証と Functions のコンパイルを実行する。Dependabot は npm と GitHub Actions の更新を週次で確認する。

## 公開

GitHub の main 更新から既存の Cloudflare Pages `mypage` が `npm run build` を実行する。出力は `dist/`。Pages の本番・プレビューの `NODE_VERSION` も24.22.2に合わせる。

最新の Astro Cloudflare adapter は Pages をサポートしないため使わず、ブログは静的生成し、コメントだけを `functions/api/comments.ts` で処理する。Functions をローカルで確認する場合はビルド後に `npm run dev:pages` を使う。

ビルド後に `scripts/security-headers.mjs` が生成HTMLからインラインスクリプトの SHA-256 を計算し、CSP・HSTS等を `dist/_headers` に生成する。記事やスクリプトを変更したら再ビルドする。

## コメント送信の設定

現在、送信に必要な設定が未登録のため受付は停止する。未設定時にも Functions の初期化は成功し、GET は `available: false`、正常な入力に対するPOSTは503を返す。フォームは受付停止を表示する。

有効にするときは、Cloudflare Pages に以下を設定する。秘密の値を Git やブラウザー向け環境変数へ入れないこと。

- `RESEND_API_KEY`：Resend の送信キー（シークレット）
- `CONTACT_EMAIL`：固定の送信先
- `CONTACT_FROM`：Resend で検証済みの送信元
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`：`action: comment`、利用する本番・プレビューのホスト名に対応する Turnstile 設定
- `COMMENT_LIMITS`：KV namespace binding。Wrangler設定を使う場合は、作成した名前空間IDを `kv_namespaces` に設定する。例：`{"binding":"COMMENT_LIMITS","id":"作成した namespace ID"}`

全設定とKVがそろうまで送信は有効にしない。ローカルのシークレットは `.dev.vars.example` を参考に、Git管理対象外の `.dev.vars` に設定する。Turnstile の本番チェックをテスト用キーで代用しない。

入力は型・メール形式・長さ（本文5000文字）・総サイズ（24KiB）を検証する。別オリジン、確認に失敗した/再利用されたTurnstileトークン、異なるホスト名・action は拒否する。メール本文はプレーンテキスト、宛先は固定し、利用者入力から変更しない。

KVではIPをシークレット付きHMACに変換して保存し、生のIP・メール・本文を保存しない。Turnstile検証後の送信試行に対し、1 IPあたり10分5回・全体で1日50回の予算を設ける。未検証の呼び出しでは全体の送信予算を消費しない。ただしKVは結果整合で、カウンターは厳密な同時実行上限ではない。Turnstileの検証と併用し、必要に応じてCloudflareエッジ側でもレート制限を設定する。KV・確認・送信サービスに障害がある場合は送信を拒否する。

実メールを送るテストには送信者の明示的な許可が必要。回帰テストはすべてモックで実行する。
