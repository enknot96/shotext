# E: ドキュメントの更新・バージョン番号・手動テスト表

- 着手条件: D が dev にマージ済み
- 対応するSPEC: 4.9、6（手動テスト）
- 編集してよいファイル（これ以外は禁止）
  - `docs/chrome-store-listing.md`
  - `docs/privacy-policy.md`
  - `README.md`
  - `docs/manual-test-checklist.md`（新規）
  - `packages/local-ocr/manifest.json`（`version` のみ）
  - `packages/local-ocr/package.json`（`version` のみ）
- 追加してよい依存パッケージ: なし
- **コードは変更しない**

## 1. バージョン番号

- `packages/local-ocr/manifest.json` と `packages/local-ocr/package.json` の `version` を `1.1.0` にする
- ほかの `package.json` の version は変えない

## 2. docs/chrome-store-listing.md（追記のみ）

- **既存の文章は1文字も変えない**。英語版の `■ Features` と、日本語版の `■ 特徴` の末尾に、次の箇条を追記する
- 各言語の箇条のスタイル（英語は `- `、日本語は `・`）に合わせる

英語版（`■ Features` の末尾）

```
- Smart formatting: wrapped lines in prose are joined, code keeps its line breaks and indentation (editor line numbers are removed), and terminal prompts like "$" are stripped
- Reads dark-themed code editors well (images are enhanced before OCR)
- Need a quick fix? Click "Edit" on the toast to adjust the text and copy it again
- Japanese recognition turns on automatically when your browser language is Japanese
```

日本語版（`■ 特徴` の末尾）

```
・文章は折り返しを自動でつなぎ、コードは改行とインデントを保持（エディタの行番号は除去）、ターミナルは「$」などのプロンプトを除去
・黒背景のエディタ画面も読み取りやすいよう、OCRの前に画像を自動で補正
・コピー後にトーストの「Edit」から、テキストを直して再コピーできます
・ブラウザの言語が日本語の場合は、日本語の認識が自動で有効になります
```

- 英語版の `■ How to use` と、日本語版の `■ 使い方` は変えない

## 3. docs/privacy-policy.md

日英の両方を、次のように更新する。

- 冒頭の `最終更新日 / Last updated` を、作業日の日付（`YYYY-MM-DD`）にする
- 権限の表に `scripting` の行を追加する
  - 日本語: `` | `scripting` | ショートカット操作時に、現在のタブだけに範囲選択の機能を読み込むため | ``
  - 英語: `` | `scripting` | To load the selection feature into the current tab only, when you press the shortcut | ``
- `<all_urls>` について説明している段落（日本語27行目付近、英語57行目付近）を、次の文に**置き換える**
  - 日本語: `範囲選択の機能は、ショートカットを押したときに、そのとき開いているタブだけに読み込まれます。それ以外のページで動作したり、閲覧内容を読み取ったりすることはありません。`
  - 英語: `The selection feature is loaded only into the tab you're viewing, and only when you press the shortcut. It does not run on other pages or read your browsing content.`
- 「収集する情報」「Information We Collect」の内容は変えない（v1.1 でも外部送信や保存は無いため）

## 4. README.md

- 英語版の `### Usage` と、日本語版の `### 使い方` に、次の1行を**最後の手順の後ろに**追記する
  - 英語: `5. (Optional) Click "Edit" on the toast to fix the text, switch between Text / Code / Terminal formatting, and copy again`
  - 日本語: `5. （必要なら）トーストの「Edit」から、テキストの修正や、文章・コード・ターミナルの整形の切り替えをして、再コピーできます`
- 英語版の `### What is this?` と、日本語版の `### これは何？` にある「日本語・英語に対応」の箇条の後ろに、ブラウザの言語が日本語のときだけ日本語の認識が有効になる旨を追記する
  - 英語: `  - Japanese recognition is enabled automatically when your browser language is Japanese`
  - 日本語: `  - 日本語の認識は、ブラウザの言語が日本語の場合に自動で有効になります`
- `### Architecture` / `### 構成` の `packages/core` の説明を、`the selection overlay, image preprocessing, text formatting, and the toast / edit panel UI` / `範囲選択UI、画像の前処理、テキスト整形、トースト・編集パネルなどの共通ロジック` にする
- 開発者向けに、英語版の `### Installation` の末尾と、日本語版の `### インストール` の末尾に、`pnpm check`（型チェック・テスト・ビルドをまとめて実行）の説明を1行追記する

## 5. docs/manual-test-checklist.md（新規）

A〜D の PR 本文にある「手動確認してほしい点」と SPEC の「6. テスト方針」の手動テストを、**重複を除いて1つのチェックリストにまとめる**。

- 形式: Markdown のチェックボックス（`- [ ]`）
- 見出しで分類する: `## 読み取り精度` / `## 整形` / `## 編集パネル・トースト` / `## エラー・例外` / `## 注入・権限` / `## 言語`
- 各項目に「手順」と「期待結果」を1行ずつ書く
- A〜D の PR 本文は `gh pr view <番号> --json body` などで取得する。取得できない場合は、`docs/tasks/A〜D` の「手動確認してほしい点」から作る

## 受入条件

- `pnpm check` が成功する（コードを変えていないことの確認）
- 変更したのは「編集してよいファイル」だけで、manifest と package.json は `version` の行だけが変わっている
- `docs/chrome-store-listing.md` の差分が、追記の行だけになっている
