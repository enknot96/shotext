# W0: 土台（契約・スタブ・テスト基盤）

- 着手条件: なし
- 担当: ローカルのセッション（Opus 5.5）が実施する予定。クラウドで実施する場合もこの指示書に従う
- 目的: A・B・C が**並列に作業しても衝突しない**よう、共有の型（契約）、スタブ関数、テスト基盤、`pnpm check` を先に確定させる
- **ユーザーから見た挙動は一切変えない**（リファクタリングのみ）

## やること

### 1. テスト基盤

- `packages/core` に `vitest` を devDependency として追加する（インストール時点の最新安定版で、vite 8 と互換のもの）
- `packages/core/package.json` の scripts に `"test": "vitest run"` を追加する
- ルートの `package.json` の scripts を次のようにする（既存の `test` のエラー用の定義は置き換える）

```json
"test": "pnpm --filter @shotext/core test",
"typecheck": "tsc -p packages/core --noEmit && tsc -p packages/local-ocr --noEmit",
"build": "pnpm --filter @shotext/local-ocr build",
"check": "pnpm typecheck && pnpm test && pnpm build"
```

- 既存の `joinWrappedLines` の挙動を固定するテスト（characterization test）を `packages/core/src/textFormat.test.ts` に書く
  - 日本語の折り返しが連結されること
  - 文末記号（`。！？` など）で終わる行は改行が残ること
  - 空行（段落の区切り）が残ること
  - ※ 英語の行が連結されるときにスペースが入らない現状の挙動は、**A で修正する対象なのでテストに含めない**

### 2. 契約（`packages/core/src/types.ts`）

`docs/tasks/00-common.md` の「8. 共有の契約」のとおりに書き換える。

- 旧 `OcrResult` 型は削除し、`OcrOutput` に置き換える
- 旧メッセージの `OCR_SELECTION_DONE` と `COPY_TO_CLIPBOARD` は削除する（`SELECTION_DONE` と `OCR_RESULT` に置き換え）
- `SelectionRect` は変更しない

### 3. スタブ関数

| ファイル | 内容 |
|---|---|
| `core/src/textClassify.ts`（新規） | `classifyText(rawText: string): TextType` を作る。常に `"prose"` を返す |
| `core/src/textFormat.ts` | `formatText(input, type)` を追加する。`prose` は `joinWrappedLines(input.rawText)`、それ以外は `input.rawText` を返す。`joinWrappedLines` は残す |
| `core/src/preprocess.ts`（新規） | `preprocessImage(blob: Blob): Promise<Blob>` を作る。受け取った画像をそのまま返す |
| `core/src/ocrLanguage.ts`（新規） | `langsForUiLanguage(uiLanguage: string): string` を作る。常に `"jpn+eng"` を返す（現行の挙動） |
| `core/src/index.ts` | `textClassify`・`preprocess`・`ocrLanguage` の export を追加する |

### 4. 新しい契約への移行（挙動は変えない）

| ファイル | 変更内容 |
|---|---|
| `local-ocr/src/engines/tesseractEngine.ts` | `recognize` が `OcrOutput` を返すようにする（`rawText: data.text.trim()`、`lines: []`）。`joinWrappedLines` の呼び出しは削除する（整形は content 側に移すため） |
| `local-ocr/src/offscreen.ts` | `RUN_OCR` を受け取り、`captureAndCrop` → `preprocessImage` → `engine.recognize` を実行して `OCR_RESULT { tabId, output }` を送る。`uiLanguage` はまだ使わない |
| `local-ocr/src/background.ts` | グローバル変数 `activeTabId` を廃止する。`SELECTION_DONE` の tabId は `sender.tab.id` から取り、`RUN_OCR` に `tabId` と `uiLanguage: chrome.i18n.getUILanguage()` を入れて送る。offscreen から届いた `OCR_RESULT` と `OCR_ERROR` は、`chrome.tabs.sendMessage(message.tabId, message)` でそのまま転送する |
| `local-ocr/src/content.ts` | `SELECTION_DONE` を送る。`OCR_RESULT` を受け取ったら `formatText(output, classifyText(output.rawText))` の結果をクリップボードにコピーし、従来どおり `Copied!` を表示する |

- `manifest.json`・静的なコンテンツスクリプト・通知の文言は、**W0 では変えない**（C の担当）

### 5. ドキュメント

- `docs/SPEC-v1.1.md` と `docs/tasks/*` をコミットに含める

## 受入条件

- `pnpm check` がすべて成功する
- ビルドした拡張機能が、変更前と同じ挙動をする（ローカルのセッションで実機を確認する）
- `types.ts` が `00-common.md` の「8. 共有の契約」と一致している
