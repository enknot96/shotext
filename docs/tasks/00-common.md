# 全セッション共通ルール

このファイルは、v1.1 を実装するすべてのクラウドセッションが最初に読むルールです。タスク固有の指示（`docs/tasks/<ID>-*.md`）と食い違う場合は、**タスク固有の指示を優先**してください。

## 1. あなたの役割

- 指示書と `docs/SPEC-v1.1.md` に従って実装し、`dev` ブランチ向けの Pull Request を作成する
- **オーナーへの質問は不要**。判断が必要になったら、「2. 判断に迷ったとき」に従って自分で決める
- PR はローカルのセッション（Opus 5.5）とオーナーがレビューする。レビューしやすい差分にすることを最優先する

## 2. 判断に迷ったとき

1. 指示書に書いてあれば、指示書どおりにする
2. 指示書に無く SPEC に書いてあれば、SPEC どおりにする
3. どちらにも無ければ、**変更が小さく元に戻しやすい方**を選ぶ
4. 3 で決めたことは、すべて PR 本文の「判断メモ」に「何を・なぜ」の形で書く

次の場合は**実装を進めず**、PR本文の「未対応・残課題」に理由を書いたうえで、できた範囲で PR を作る。

- `packages/core/src/types.ts` の契約（型）を変えないと実装できない
- 担当外のファイルを変更しないと実装できない
- 完了前チェックがどうしても通らない

## 3. 禁止事項

- 担当外ファイルの編集（`docs/tasks/README.md` の「ファイル担当表」を参照）
- `packages/core/src/types.ts` の変更（W0 以外）
- タスクで指定されていない依存パッケージの追加
- `main` や `dev` への直接 push、force push
- `.env` や `.env.*` など、秘密情報を含む可能性のあるファイルを開くこと
- タスクと無関係なリファクタリング、フォーマットの一括変更、既存コメントの削除
- SPEC の「非目標」に書かれた機能の実装

## 4. コーディング規約（既存コードに合わせる）

- TypeScript（strict）。`any` は使わない。やむを得ない場合は `unknown` から型を絞り込む
- インデントはスペース2つ、ダブルクォート、セミコロンあり
- 識別子（変数名・関数名）は英語で書く
- **コメントは日本語**。既存コードと同じく「なぜそうしているか」を中心に書き、密度も既存コードに合わせる
- **ユーザーに見える文言はすべて英語**。短く平易にする（SPEC 4.8）
- 新しいフレームワーク（React など）は導入しない。DOM API を直接使う
- 純粋な関数（DOM や chrome API に依存しないもの）はなるべく分離し、テストを書く

## 5. セットアップ

クラウド環境には Node 22 と pnpm が最初から入っています（公式ドキュメント: code.claude.com/docs/en/cloud-environments）。

```bash
pnpm install
```

`pnpm` が見つからない場合だけ、`corepack enable` を実行してください（それでも失敗する場合は `npm i -g pnpm@10.33.0`）。

## 6. 完了前チェック（すべて通すこと）

```bash
pnpm check
```

`pnpm check` は、次をまとめて実行します（W0 で定義）。

1. `packages/core` と `packages/local-ocr` の型チェック（`tsc --noEmit`）
2. `packages/core` の単体テスト（vitest）
3. 拡張機能のビルド（`pnpm --filter @shotext/local-ocr build`）

クラウド環境では Chrome で拡張機能を動かせません。実機でしか確認できない点は、PR本文の「手動確認してほしい点」に書いてください。

## 7. ブランチ・コミット・PR

- ブランチ名: `feat/v1.1-<タスクID小文字>-<短い英語名>`（例: `feat/v1.1-a-text-format`）
  - 環境の制約で指定の名前にできない場合は、環境の既定の名前でよい（PR本文にその旨を書く）
- コミット: 意味のある単位で小さく分ける。メッセージは `feat(core): 〜` / `fix(local-ocr): 〜` / `test(core): 〜` の形にし、説明は日本語で書く
- PR
  - base ブランチ: `dev`
  - タイトル: `[v1.1-<ID>] <タスク名>`（例: `[v1.1-A] 文章/コード/ターミナルの判定と整形`）
  - 本文は次のテンプレートどおりに書く

```markdown
## 概要
（このPRで何ができるようになるか、1〜3行）

## 対応したSPEC項目
- SPEC 4.x: …

## 変更ファイル
- `path/to/file.ts`: 変更内容の要約

## テスト結果
- `pnpm check`: 成功 / 失敗（失敗した場合はログの要点）
- 追加したテスト: 件数と対象

## 判断メモ
- （指示書やSPECに無く、自分で決めたこと。「何を・なぜ」）

## 手動確認してほしい点
- （Chromeの実機でしか確認できないこと）

## 未対応・残課題
- （無ければ「なし」）
```

## 8. 共有の契約（W0 で確定済み。変更禁止）

`packages/core/src/types.ts` の主な型です。実装はこの型に合わせてください。

```ts
export type TextType = "prose" | "code" | "terminal";

export interface OcrBbox { x0: number; y0: number; x1: number; y1: number; }
export interface OcrWord { text: string; bbox: OcrBbox; }
export interface OcrLine { text: string; bbox: OcrBbox; words: OcrWord[]; }

// OCRエンジンの出力。整形前の生テキストと、行ごとの座標を持つ
export interface OcrOutput {
  rawText: string;
  lines: OcrLine[];
  elapsedMs: number;
  engineName: string;
}

export interface OcrEngine {
  readonly name: string;
  recognize(imageBlob: Blob): Promise<OcrOutput>;
}

export type ExtensionMessage =
  | { type: "START_SELECTION" }                                            // background → content
  | { type: "SELECTION_DONE"; rect: SelectionRect; devicePixelRatio: number } // content → background（tabId は sender.tab.id から取る）
  | { type: "RUN_OCR"; tabId: number; dataUrl: string; rect: SelectionRect; devicePixelRatio: number; uiLanguage: string } // background → offscreen
  | { type: "OCR_RESULT"; tabId: number; output: OcrOutput }               // offscreen → background → content
  | { type: "OCR_ERROR"; tabId: number; reason: "ocr_failed" };            // offscreen → background → content
```

W0 の時点で、次の関数が**スタブとして存在**します。A・B は、この中身を本実装に置き換えます（シグネチャは変えない）。

| 関数 | ファイル | スタブの挙動 |
|---|---|---|
| `classifyText(rawText: string): TextType` | `core/src/textClassify.ts` | 常に `"prose"` を返す |
| `formatText(input: Pick<OcrOutput, "rawText" \| "lines">, type: TextType): string` | `core/src/textFormat.ts` | prose は従来の `joinWrappedLines`、それ以外は生テキストのまま |
| `preprocessImage(blob: Blob): Promise<Blob>` | `core/src/preprocess.ts` | 受け取った画像をそのまま返す |
| `langsForUiLanguage(uiLanguage: string): string` | `core/src/ocrLanguage.ts` | 常に `"jpn+eng"` を返す |
