---
title: 'gh でエディタから離れずに作業する'
description: 'gh を使って、issue の作成から紐づいたブランチの作成、PR の作成とマージを行う記事です。'
pubDate: 'Mar 16 2026'
icon: '🐙'
tags: ['git', 'github', 'gh']
# heroImage: '/blog-placeholder-1.jpg'
---

# はじめに
`gh`、つかってますか？
「エディタとブラウザを行き来する時間は、もっとも簡単に減らせる無駄だ」みたいなことを誰かが言っていた気がするので、最近は DevOps の導入をがんばったりしています。その中で触り心地が良かったものを紹介。

この記事では、github の公式 CLI である `gh` コマンドを使って
- issue の作成
- issue に紐づいたブランチの作成、移動
- PR の作成
- PR のマージ

を行います。

https://cli.github.com

# 導入
そもそも `gh` を使ったことがない場合は、インストール作業が必要になります。

https://github.com/cli/cli?tab=readme-ov-file#installation

## macOS
Homebrew からインストールするのが一番早そう。

https://github.com/cli/cli/blob/trunk/docs/install_macos.md#homebrew

```sh
brew install gh
```

## Windows
WSL ではないほう。winget でよいらしいです。

https://github.com/cli/cli/blob/trunk/docs/install_windows.md#winget

```sh
winget install --id GitHub.cli
```

## Linux / Unix
WSL 上で Ubuntu 使ってるくらいしか触ってないので、それ以上のことは以下参照。

https://github.com/cli/cli/blob/trunk/docs/install_linux.md#debian

基本これでいけると思います。

```sh
(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
	&& sudo mkdir -p -m 755 /etc/apt/keyrings \
	&& out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
	&& cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
	&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
	&& sudo mkdir -p -m 755 /etc/apt/sources.list.d \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
	&& sudo apt update \
	&& sudo apt install gh -y
```

# やってみる
さて、実際にやってみます。
前提としてなにかしらのプロジェクトを立てていて、GitHub 上にリポジトリが立っているものとします。

## issue を作成する
まずは Issue を立ててみます。
以下のコマンドで対話プロンプトが起動するので、必要な情報をチマチマ入力する感じです。

```sh
gh issue create
```

(ここにキャプチャ)

ちなみに gh のデフォルトエディタは nano になっているんですが、以下のコマンドで vim とかに変更できます。

```sh
gh config set editor vim
```

github 側で確認してみると、ちゃんと issue が生えてるのが確認できます。

