# mypage
自分用サイト　なまえは未定

## 技術スタック
*   **Framework**: [Astro](https://astro.build/)
*   **Hosting**: Cloudflare Pages

## デプロイ
1.  ローカルでMarkdown記事を作成・推敲
2.  GitHubリポジトリへコミット＆プッシュ
3.  Cloudflare Pagesがフックを検知し、ビルドコマンド (`npm run build`) を実行
4.  生成された静的ファイル群 (`dist/`) が実際のドメインに自動で配信される
