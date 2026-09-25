# C: スクリプトの注入方式とエラー処理

- 着手条件: W0 が dev にマージ済み
- 対応するSPEC: 4.6、4.7、4.8（manifest の文言のみ）
- 編集してよいファイル（これ以外は禁止）
  - `packages/local-ocr/manifest.json`
  - `packages/local-ocr/src/background.ts`
  - `packages/local-ocr/src/content.ts`
  - `packages/local-ocr/src/vite-env.d.ts`（新規）
  - `packages/local-ocr/vite.config.ts`（必要な場合のみ）
  - `packages/core/src/selection.ts`
- 追加してよい依存パッケージ: なし

## 前提知識（一次情報で確認済み）

- `activeTab` は「commands API のキーボードショートカットの実行」でも付与される。`scripting` 権限があれば、そのタブに `chrome.scripting.executeScript()` を実行できる（Chrome公式 activeTab）
- `tabs.captureVisibleTab` は、`activeTab` があれば呼べる（Chrome公式 tabs API）
- `scripting` と `activeTab` は、どちらも権限の警告が出ない。更新しても拡張機能は無効化されない（Chrome公式 permissions-list / permission-warnings）
- `web_accessible_resources` は、拡張機能自身のページ（offscreen を含む）からのアクセスには不要（Chrome公式 web-accessible-resources）
- `@crxjs/vite-plugin` 2.7.1 では、`import fileName from "./content.ts?script&iife"` とすると、ビルド後のスクリプトのファイル名が得られる（`node_modules/@crxjs/vite-plugin/client.d.ts` で確認）。IIFE 形式は動的な import を使わないので、`web_accessible_resources` が不要になる

## 1. manifest.json

- `content_scripts` を**削除**する
- `web_accessible_resources` を**削除**する
- `permissions` に `"scripting"` を追加する（`["activeTab", "offscreen", "notifications", "clipboardWrite", "scripting"]`）
- `description` を `"Select an area on screen and copy its text (OCR)."` にする
- `commands["take-screenshot"].description` を `"Select an area to copy text"` にする
- `name`・`version`・`icons`・`action`・`content_security_policy` は変えない

## 2. 型定義（`src/vite-env.d.ts`、新規）

```ts
/// <reference types="@crxjs/vite-plugin/client" />
```

- `tsc -p packages/local-ocr --noEmit` で `?script&iife` の import が型エラーにならないことを確認する

## 3. background.ts

### ショートカットが押されたとき

1. `chrome.tabs.query({ active: true, currentWindow: true })` でタブを取得する。`tab.id` が無ければ何もしない
2. `chrome.scripting.executeScript({ target: { tabId }, files: [contentScript] })` で content を注入する（`import contentScript from "./content.ts?script&iife";`）
   - 例外が出たら（`chrome://` のページや Web Store など、注入できないページ）、`notify("Can't capture this page")` を出して終了する
3. `chrome.tabs.sendMessage(tabId, { type: "START_SELECTION" })` を送る

### `SELECTION_DONE` を受け取ったとき

1. `tabId = sender.tab?.id`、`windowId = sender.tab?.windowId`。どちらかが無ければ何もしない
2. 現在アクティブなタブを取得し、`tabId` と違っていたら `notify("Tab changed. Please try again.")` を出して終了する
3. `chrome.tabs.captureVisibleTab(windowId, { format: "png" })` で撮影する。例外が出たら `notify("Can't capture this page")` を出して終了する
4. `ensureOffscreenDocument()` を呼び、`RUN_OCR` を送る（W0 と同じ内容）

### `OCR_RESULT` と `OCR_ERROR` を受け取ったとき

- `chrome.tabs.sendMessage(message.tabId, message)` で転送する。タブが閉じられていた場合の例外は握りつぶす（`.catch(() => {})`。理由をコメントに書く）

### 通知

```ts
// 通知のタイトルは拡張機能名ではなく短い "ShoText" にする（通知欄で読みやすくするため）
function notify(message: string) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/warning128.png"),
    title: "ShoText",
    message,
  });
}
```

### offscreen document の二重作成の防止

- ショートカットを素早く2回押すと、`createDocument` が2回呼ばれて例外になる。作成中の Promise をモジュール変数に持ち、作成中なら同じ Promise を待つようにする

## 4. content.ts

### 二重注入の防止

- ショートカットを押すたびに `executeScript` が同じファイルを実行する。**リスナーの登録は1回だけ**になるよう、グローバルのフラグで防ぐ

```ts
declare global {
  interface Window {
    __shotextInjected?: boolean;
  }
}
if (!window.__shotextInjected) {
  window.__shotextInjected = true;
  // ここでリスナーを登録する
}
```

### 処理の流れ

| 受け取るもの・状況 | 挙動 |
|---|---|
| `START_SELECTION` | `startSelectionOverlay()` を呼ぶ。`null`（Esc）なら終了 |
| 選択が小さすぎる（`width < MIN_SELECTION_SIZE` または `height < MIN_SELECTION_SIZE`） | `showCopyToast(rect, "Selection too small")` を表示して終了する（`SELECTION_DONE` は送らない） |
| それ以外 | `SELECTION_DONE` を送る |
| `OCR_RESULT` | `type = classifyText(output.rawText)`、`text = formatText(output, type)` を求める。`text.trim() === ""` なら `showCopyToast(rect, "No text found")` を表示し、**クリップボードは上書きしない**。それ以外は `navigator.clipboard.writeText(text)` を実行し、成功したら `"Copied!"`、失敗したら `"Copy failed"` を表示する |
| `OCR_ERROR` | `showCopyToast(rect, "Couldn't read text")` を表示する |

- 直近の結果 `{ output, type, rect }` をモジュール変数 `lastResult` に保持する（D が編集パネルで使うため）
- トーストの表示には、**既存の `showCopyToast` をそのまま使う**。見た目の改善、`Reading…` の表示、コピー失敗時に編集パネルを開く処理は D が担当するので、C では実装しない

## 5. selection.ts

- `export const MIN_SELECTION_SIZE = 8;` を追加する（単位は CSS px）
- オーバーレイの追加先を `document.fullscreenElement ?? document.body` にする（全画面表示の動画の上でも選択できるようにするため）
- **撮影に選択枠が写り込まないようにする**: `cleanup()` でオーバーレイを消した後、`requestAnimationFrame` を2回待ってから `resolve(rect)` する（削除が画面に反映されてから撮影させるため。理由をコメントに書く）
- それ以外の挙動（Esc でキャンセル、スクロールの禁止と復元）は変えない

## 受入条件

- `pnpm check` が成功する
- ビルド後の `packages/local-ocr/dist/manifest.json` に、`content_scripts` と `web_accessible_resources` が含まれていない（crxjs が自動で追加していないか確認し、結果を PR 本文に書く）
- ビルド後の `dist` に、IIFE 形式の content スクリプトが出力されている
- 編集したのは「編集してよいファイル」だけ

## 手動確認してほしい点（PR本文に転記すること）

- 拡張機能をインストール（更新）する**前から開いていたタブ**で、再読み込みせずにショートカットが効く
- 同じタブでショートカットを3回以上使っても、トーストが二重に出ない（リスナーが重複登録されていない）
- `chrome://extensions` や Chrome Web Store のページで、`Can't capture this page` の通知が出る
- クリックしただけ（ドラッグしない）で、`Selection too small` が出る
- 文字の無い領域を選ぶと `No text found` が出て、クリップボードの中身が変わらない
- YouTube の全画面表示で、選択とOCRができる（SPEC の要確認C）
- 撮影した画像に、選択枠や半透明の暗い幕が写り込んでいない
- 拡張機能を更新したとき、権限の再承認を求められない
