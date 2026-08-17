# ショッテキ！(Shotext！)

画面の好きな範囲を選択するだけで、その中の文字をローカルでOCRしてクリップボードにコピーするChrome拡張機能です。

🇯🇵 [日本語](#日本語) | 🇺🇸 [English](#english)

---

## 日本語

### これは何？

「ショッテキ！」は、Webページ上の好きな範囲をドラッグで選択すると、その範囲を自動でOCR（文字認識）してテキスト化し、クリップボードにコピーしてくれるChrome拡張機能です。

- OCRは[Tesseract.js](https://github.com/naptha/tesseract.js)を使い、すべて**ローカル（ブラウザ内）で処理**します。画像や認識結果が外部サーバーに送信されることはありません
- 日本語・英語に対応

### 使い方

1. ショートカット `Alt+Shift+D` を押す
2. 文字を含む範囲をドラッグで選択する
3. 少し待つと、認識されたテキストが自動でクリップボードにコピーされる（コピー完了はトースト通知でお知らせします）
4. あとは好きな場所に貼り付けるだけ

### インストール（現在Chromeウェブストア未公開・ソースからビルド）

```bash
git clone <このリポジトリのURL>
cd shotext
pnpm install
pnpm --filter @shotext/local-ocr build
```

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」を選択
4. `packages/local-ocr/dist` フォルダを選択する

### 構成

pnpm workspaceによるmonorepo構成です。

- `packages/core` — 範囲選択UI、画像切り抜き、トースト通知などの共通ロジック
- `packages/local-ocr` — Tesseract.js（WebAssembly）を使ったローカルOCR版の拡張機能本体
- ビルドには Vite + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) を使用

### 開発の背景

なぜこれを作ったか、という話はZenn / dev.toの記事にまとめています。

- Zenn（日本語）: (記事公開後に追記)
- dev.to（English）: (will be added after publishing)

### ライセンス

[MIT License](./LICENSE)

---

## English

### What is this?

**Shotext！** is a Chrome extension that lets you drag-select any area of a web page, automatically runs OCR on it, and copies the recognized text straight to your clipboard.

- OCR runs via [Tesseract.js](https://github.com/naptha/tesseract.js), fully **on-device in the browser**. No image or recognized text is ever sent to any server
- Supports Japanese and English

### Usage

1. Press `Alt+Shift+D`
2. Drag to select an area containing text
3. Wait a moment — the recognized text is automatically copied to your clipboard (a toast notification confirms the copy)
4. Paste it anywhere you like

### Installation (not yet on the Chrome Web Store — build from source)

```bash
git clone <this repository URL>
cd shotext
pnpm install
pnpm --filter @shotext/local-ocr build
```

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `packages/local-ocr/dist` folder

### Architecture

This is a pnpm workspace monorepo.

- `packages/core` — shared logic: the selection overlay UI, image cropping, and the copy toast
- `packages/local-ocr` — the actual extension, using Tesseract.js (WebAssembly) for fully local OCR
- Built with Vite + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)

### Why I built this

The backstory behind this project is written up on Zenn / dev.to.

- Zenn (Japanese): (will be added after publishing)
- dev.to (English): (will be added after publishing)

### License

[MIT License](./LICENSE)
