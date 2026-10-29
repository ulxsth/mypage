# mypage
自分用サイト　なまえは未定

## 技術スタック
*   **Framework**: [Astro](https://astro.build/)
*   **Hosting**: Cloudflare Pages

Node.js は24.22.2に固定しています。`npm ci --ignore-scripts` の後、`npm run verify` で型・テスト・ビルド・依存監査を実行できます。ブログは静的生成、コメント API は Pages Functions です。

セキュリティ検証・公開・コメント受付の設定は [運用手順](docs/security-and-deploy.md) を参照してください。

## 記事の作成
*   `npm run new:article <記事名>` で記事のテンプレートを作成
*   `src/content/blog/` に記事が作成される

## デプロイ
1.  ローカルでMarkdown記事を作成・推敲
2.  GitHubリポジトリへコミット＆プッシュ
3.  Cloudflare Pagesがフックを検知し、ビルドコマンド (`npm run build`) を実行
4.  生成された静的ファイル群 (`dist/`) が実際のドメインに自動で配信される
