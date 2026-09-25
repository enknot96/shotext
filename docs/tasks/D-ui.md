# D: UI（トースト・編集パネル・ポップアップ）

- 着手条件: C が dev にマージ済み（A・B も先にマージしておくのが望ましい）
- 対応するSPEC: 4.5、4.6（表示部分）、4.8
- 編集してよいファイル（これ以外は禁止）
  - `packages/core/src/ui/text.ts`（新規）
  - `packages/core/src/ui/shadowHost.ts`（新規）
  - `packages/core/src/ui/toast.ts`（新規）
  - `packages/core/src/ui/editPanel.ts`（新規）
  - `packages/core/src/ui/*.test.ts`（新規。純粋な関数だけをテストする）
  - `packages/core/src/toast.ts`（**削除する**）
  - `packages/core/src/index.ts`
  - `packages/local-ocr/src/content.ts`
  - `packages/local-ocr/src/popup/popup.html`
  - `packages/local-ocr/src/popup/popup.ts`（新規）
- 追加してよい依存パッケージ: なし

## 1. 文言（`ui/text.ts`）

ユーザーに見える文言は、すべてこのファイルに集める。**英語で、短く平易に**書く。

```ts
export const UI_TEXT = {
  reading: "Reading…",
  copied: "Copied!",
  edit: "Edit",
  copy: "Copy",
  close: "Close",
  noText: "No text found",
  tooSmall: "Selection too small",
  readFailed: "Couldn't read text",
  copyFailedHint: "Press Ctrl+C (⌘C on Mac) to copy",
  typeText: "Text",
  typeCode: "Code",
  typeTerminal: "Terminal",
} as const;
```

## 2. Shadow DOM のホスト（`ui/shadowHost.ts`）

- トーストと編集パネルは、ページの CSS の影響を受けないよう **Shadow DOM の中に描画する**
- ホスト要素は1つだけ作って使い回す（`<shotext-root>` など、ページと衝突しにくいタグ名にする）
- 追加先は `document.fullscreenElement ?? document.documentElement`。全画面表示に入ったり出たりした場合に備えて、表示のたびに追加先を確認し、必要なら付け替える
- ホストのスタイル: `position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;`。トーストとパネル自身には `pointer-events: auto` を付ける
- スタイルは `<style>` 要素で Shadow DOM の中に入れる。フォントは `system-ui, sans-serif`、アクセントの色は既存の `#4da3ff`

## 3. トースト（`ui/toast.ts`）

```ts
export type ToastState =
  | { kind: "reading" }
  | { kind: "copied"; preview: string; onEdit: () => void }
  | { kind: "info"; message: string };

export function showToast(rect: SelectionRect, state: ToastState): void;
export function hideToast(): void;
```

- トーストは**常に1つだけ**表示する。`showToast` を呼ぶと、前のトーストは内容が置き換わる
- 位置: 選択範囲の下 8px。画面の下からはみ出す場合は、選択範囲の上に出す。左右は画面内（端から 8px）に収める
  - 位置を計算する部分は純粋な関数 `placeNear(rect, size, viewport)` に分けて、テストを書く
- 表示の内容と消えるまでの時間

| kind | 内容 | 消えるまで |
|---|---|---|
| `reading` | `Reading…` | 次の `showToast` まで消えない。ただし、安全のため30秒で消す |
| `copied` | `Copied!`、プレビュー、`Edit` ボタン | 4秒。**マウスを乗せている間は消えない**（離れてから4秒） |
| `info` | `message` | 3秒 |

- プレビューは、改行を半角スペースに置き換え、30文字を超えたら29文字＋`…`にする（純粋な関数 `makePreview(text)` に分けてテストを書く）
- 表示と非表示には、既存と同じくフェード（200ms）を付ける

## 4. 編集パネル（`ui/editPanel.ts`）

```ts
export interface EditPanelOptions {
  rect: SelectionRect;
  output: Pick<OcrOutput, "rawText" | "lines">;
  type: TextType;
  copyFailed?: boolean; // true: 自動コピーに失敗したときに開く（全選択した状態にし、ヒントを表示する）
}
export function openEditPanel(options: EditPanelOptions): void;
export function closeEditPanel(): void;
```

構成は次のとおり。

- 上部: 整形タイプの切り替え（`Text` / `Code` / `Terminal` の3つのボタン。選択中のものを強調する）と、閉じるボタン（`×`、`aria-label="Close"`）
- 中央: `<textarea>`。初期値は `formatText(output, type)`。`code` と `terminal` のときは等幅フォントにする
- 下部: `Copy` ボタン。`copyFailed` のときは `copyFailedHint` を表示する

挙動は次のとおり。

- タイプを切り替えたら、`textarea` の中身を `formatText(output, 新しいtype)` で**置き換える**（手で編集した内容は破棄される。SPEC 4.5）
- `Copy` ボタン、または `Ctrl+Enter` / `Cmd+Enter` で `navigator.clipboard.writeText(textarea.value)` を実行する
  - 成功: ボタンの表示を1.5秒だけ `Copied!` にする
  - 失敗: `textarea` を全選択し、`copyFailedHint` を表示する
- 閉じる: `×`、`Esc`、パネルの外をクリック
- **パネルの中のキー操作をページに伝えない**: パネル内の `keydown`・`keyup`・`keypress` で `stopPropagation()` を呼ぶ（YouTube の `k` や `f`、スペースなどのショートカットが、入力中に反応しないようにするため）
- 開いたら `textarea` にフォーカスする（`copyFailed` のときは全選択もする）
- サイズ: 幅は `min(480px, 100vw - 32px)`、`textarea` は10行程度。位置はトーストと同じ `placeNear` を使う
- パネルは常に1つだけ。開き直すと中身が置き換わる

## 5. content.ts の配線

C で入れた暫定の `showCopyToast` 呼び出しを、次のように置き換える。

| 状況 | 表示 |
|---|---|
| `SELECTION_DONE` を送った直後 | `showToast(rect, { kind: "reading" })` |
| 選択が小さすぎる | `showToast(rect, { kind: "info", message: UI_TEXT.tooSmall })` |
| コピー成功 | `showToast(rect, { kind: "copied", preview: makePreview(text), onEdit: () => openEditPanel({ rect, output, type }) })` |
| 結果が空 | `showToast(rect, { kind: "info", message: UI_TEXT.noText })` |
| `OCR_ERROR` | `showToast(rect, { kind: "info", message: UI_TEXT.readFailed })` |
| コピー失敗 | `hideToast()` の後に `openEditPanel({ rect, output, type, copyFailed: true })` |

- 新しい選択を始めるときは、開いている編集パネルとトーストを閉じる
- `core/src/toast.ts` を削除し、`index.ts` の export を `ui/*` に置き換える

## 6. ポップアップ（`popup.html`・`popup.ts`）

- 表示する内容（英語のみ）
  - 見出し: `ShoText！`
  - 本文: `Press <kbd>{shortcut}</kbd>, then drag over text. It's copied automatically.`
  - リンク: `Change shortcut`
- `{shortcut}` は `chrome.commands.getAll()` で `take-screenshot` の現在のショートカットを取得して表示する。未設定なら `Not set` と表示する
- `Change shortcut` をクリックしたら、`chrome.tabs.create({ url: "chrome://extensions/shortcuts" })` を実行する（`chrome://` は `<a href>` では開けないため）
- 既存の見た目（幅 240px、`kbd` のスタイル）は保つ

## 受入条件

- `placeNear` と `makePreview` のテストが通る
- `pnpm check` が成功する
- `core/src/toast.ts` が削除され、どこからも参照されていない
- ユーザーに見える文言が、すべて `UI_TEXT` かポップアップの HTML にあり、英語だけになっている
- 編集したのは「編集してよいファイル」だけ

## 手動確認してほしい点（PR本文に転記すること）

- YouTube、GitHub、Qiita などで、トーストと編集パネルの見た目が崩れない
- 編集パネルに入力している間、YouTube のショートカット（`k`、`f`、スペース）が反応しない
- `Edit` → タイプの切り替え → 編集 → `Copy` で、編集後のテキストがコピーされる
- トーストにマウスを乗せている間は消えない
- 全画面表示の YouTube でも、トーストと編集パネルが見える
- ポップアップに現在のショートカットが表示され、`Change shortcut` でショートカットの設定画面が開く
