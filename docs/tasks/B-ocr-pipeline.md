# B: OCRパイプライン（前処理・言語の自動切り替え・行の座標）

- 着手条件: W0 が dev にマージ済み
- 対応するSPEC: 4.1、4.4、4.6（OCRが例外を出したときの送信部分のみ）
- 編集してよいファイル（これ以外は禁止）
  - `packages/core/src/preprocess.ts`
  - `packages/core/src/preprocess.test.ts`（新規）
  - `packages/core/src/ocrLanguage.ts`
  - `packages/core/src/ocrLanguage.test.ts`（新規）
  - `packages/core/src/capture.ts`（必要な場合のみ）
  - `packages/local-ocr/src/engines/tesseractEngine.ts`
  - `packages/local-ocr/src/offscreen.ts`
- 追加してよい依存パッケージ: なし

## 前提知識

- offscreen document では、拡張機能のAPIは `chrome.runtime` **しか使えない**（Chrome公式ドキュメント）。そのため、ブラウザの言語は background が `chrome.i18n.getUILanguage()` で取得し、`RUN_OCR.uiLanguage` で渡す（W0 で実装済み）
- tesseract.js 7.0.0 では、`worker.recognize(image, {}, { text: true, blocks: true })` とすると、`data.blocks → paragraphs → lines → words` の構造が得られる。各要素に `bbox { x0, y0, x1, y1 }` が付いている（`node_modules/tesseract.js/src/index.d.ts` で確認済み）

## 1. 画像の前処理（`core/src/preprocess.ts`）

W0 のスタブ `preprocessImage(blob: Blob): Promise<Blob>` を本実装に置き換える。第2引数に省略できるオプションを追加するのは可（既存の呼び出しと互換があるため）。

```ts
export interface PreprocessOptions {
  scale: number;           // 既定 2
  maxPixels: number;       // 既定 4_000_000（拡大後の画素数の上限）
  invertThreshold: number; // 既定 128（平均輝度がこれ未満なら反転する）
}
export function preprocessImage(blob: Blob, options?: Partial<PreprocessOptions>): Promise<Blob>;
```

処理の順番は次のとおり。

1. `createImageBitmap(blob)` で読み込む
2. 倍率を `computeScale(width, height, options)` で決める
   - 基本は `options.scale` 倍
   - 拡大後の画素数（`width * height * scale²`）が `maxPixels` を超える場合は、`Math.sqrt(maxPixels / (width * height))` まで下げる
   - 倍率は1未満にしない
3. `OffscreenCanvas` に拡大して描画する（`imageSmoothingEnabled = true`、`imageSmoothingQuality = "high"`）
4. `getImageData` で画素を取得し、`grayscaleAndNormalize(data, invertThreshold)` をかける
   - 各画素の輝度を `0.299R + 0.587G + 0.114B` で求め、RGB をすべてその値にする（アルファ値は変えない）
   - 全画素の平均輝度が `invertThreshold` 未満なら、`255 - 輝度` に反転する（黒背景に明るい文字 → 白背景に黒文字）
   - 反転したかどうかを `boolean` で返す（テスト用）
5. `putImageData` → `convertToBlob({ type: "image/png" })` で返す

- **独自の二値化はしない**（SPEC 4.1。Tesseract 内部の処理に任せる）
- `computeScale` と `grayscaleAndNormalize` は、DOM に依存しない純粋な関数として export し、`preprocess.test.ts` でテストする
  - `computeScale`: 通常のサイズなら2倍、上限を超えるサイズなら上限に収まる倍率、とても大きい画像でも1未満にならない
  - `grayscaleAndNormalize`: 白背景（明るい）は反転しない。黒背景（暗い）は反転する。アルファ値が保たれる
  - `preprocessImage` 本体は、vitest（Node）では `OffscreenCanvas` が使えないためテストしない

## 2. OCRエンジン（`local-ocr/src/engines/tesseractEngine.ts`）

- コンストラクタで言語を受け取る: `constructor(langs: string)`
- 言語を決める関数は、W0 のスタブ `core/src/ocrLanguage.ts` の `langsForUiLanguage(uiLanguage: string): string` を本実装に置き換える

```ts
// 日本語環境のユーザーは和文と英文の両方を読むが、それ以外は英語だけで十分。
// 英語だけにすれば、日本語の学習データ（約2MB）を読み込まずに済む
export function langsForUiLanguage(uiLanguage: string): string {
  return uiLanguage.toLowerCase().startsWith("ja") ? "jpn+eng" : "eng";
}
```

- `ocrLanguage.test.ts` で `"ja"`・`"ja-JP"`・`"JA"` → `"jpn+eng"`、`"en-US"`・`"fr"`・`""` → `"eng"` を確認する

- `createWorker(this.langs, 1, {...})`。OEM=1（LSTMのみ）、`preserve_interword_spaces: "1"`、各種パスの指定は既存のまま残す
- `recognize` の出力は次のとおり

```ts
const { data } = await worker.recognize(imageBlob, {}, { text: true, blocks: true });
// 返り値の OcrOutput
{
  rawText: data.text.trim(),
  lines: data.blocks → paragraphs → lines を平らにした配列
         各行 { text: line.text の末尾の改行を除いたもの, bbox: line.bbox, words: line.words.map(w => ({ text: w.text, bbox: w.bbox })) },
  elapsedMs,
  engineName: this.name,
}
```

- `data.blocks` が `null` の場合は `lines: []` にする

## 3. offscreen（`local-ocr/src/offscreen.ts`）

- エンジンは、最初の `RUN_OCR` を受け取った時点で `new TesseractEngine(langsForUiLanguage(message.uiLanguage))` として作り、以後は使い回す（Worker の作成が重いため）
- 処理の流れ: `captureAndCrop` → `preprocessImage` → `engine.recognize` → `OCR_RESULT { tabId, output }` を送る
- 途中で例外が出たら、`console.error("[shotext] OCR failed", error)` を出したうえで、`OCR_ERROR { tabId, reason: "ocr_failed" }` を送る
- 所要時間のログ（`console.log`）は残してよい

## 受入条件

- `computeScale`・`grayscaleAndNormalize`・`langsForUiLanguage` のテストが通る
- `pnpm check` が成功する
- 編集したのは「編集してよいファイル」だけ

## 手動確認してほしい点（PR本文に転記すること）

- ダークテーマのコード画面（VS Code の Dark+ など）が、変更前より正しく読み取れる
- ライトテーマの画面で、精度が落ちていない
- 小さい文字（字幕サイズなど）の読み取りが改善している
- ブラウザの言語が英語のとき、日本語の学習データ（`jpn.traineddata.gz`）が読み込まれない（DevTools の Network タブで確認）
- 初回のOCRにかかる時間が、極端に遅くなっていない（拡大の影響）
