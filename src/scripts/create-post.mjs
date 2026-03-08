import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 引数からslug名を取得
const slug = process.argv[2];

if (!slug) {
  console.error('\x1b[31m%s\x1b[0m', 'エラー: 記事のファイル名(slug)を指定してください。');
  console.log('使用例: npm run post -- my-new-article');
  process.exit(1);
}

// ファイル名の拡張子がなければ.mdを追加
const fileName = slug.endsWith('.md') || slug.endsWith('.mdx') ? slug : `${slug}.md`;
const targetDir = path.resolve(__dirname, '../../src/content/blog');
const targetPath = path.join(targetDir, fileName);

// 既にファイルが存在する場合はエラー
if (fs.existsSync(targetPath)) {
  console.error('\x1b[31m%s\x1b[0m', `エラー: ファイル ${fileName} は既に存在します。`);
  process.exit(1);
}

// 現在の日時はフロントマターに埋め込まず、ファイル更新日時を自動利用させる

// テンプレートの生成 (content.config.ts のスキーマに準拠)
const template = `---
title: '${slug} の記事'
description: 'ここに記事の説明(description)を入力します。'
icon: '📝'
# heroImage: '/blog-placeholder-1.jpg'
---

ここから本文を記述します。
`;

// ファイルの作成
fs.promises.mkdir(targetDir, { recursive: true }).then(() => {
  fs.writeFileSync(targetPath, template, 'utf-8');
  console.log('\x1b[32m%s\x1b[0m', '✨ 記事のテンプレートを作成しました！');
  console.log(`📂 パス: src/content/blog/${fileName}`);
}).catch(err => {
  console.error('\x1b[31m%s\x1b[0m', 'ファイル作成中にエラーが発生しました。');
  console.error(err);
  process.exit(1);
});
