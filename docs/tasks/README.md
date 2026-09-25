# v1.1 実装タスク一覧（クラウドセッション分担）

`docs/SPEC-v1.1.md` を、複数の Claude Code on the web セッションで分担して実装するための指示書です。

## 進め方（ウェーブ）

```
W0 土台（契約・スタブ・テスト基盤）
   │  dev にマージ後
   ├─ A 判定・整形 ─────┐
   ├─ B OCRパイプライン ─┤  ← 3つは並列に実行できる（担当ファイルが重ならない）
   └─ C 注入・エラー処理 ┘
                         │  C のマージ後（A・B も先にマージしておくのが望ましい）
                         D UI（トースト・編集パネル・ポップアップ）
                         │  D のマージ後
                         E ドキュメント・バージョン更新・手動テスト表
```

| ID | 指示書 | 着手条件 | 主な担当ファイル |
|---|---|---|---|
| W0 | [W0-foundation.md](./W0-foundation.md) | なし | `core/src/types.ts` ほか契約一式 |
| A | [A-text-format.md](./A-text-format.md) | W0 マージ済み | `core/src/textClassify.ts`, `core/src/textFormat.ts` |
| B | [B-ocr-pipeline.md](./B-ocr-pipeline.md) | W0 マージ済み | `core/src/preprocess.ts`, `local-ocr/src/engines/*`, `local-ocr/src/offscreen.ts` |
| C | [C-injection-errors.md](./C-injection-errors.md) | W0 マージ済み | `manifest.json`, `background.ts`, `content.ts`, `core/src/selection.ts` |
| D | [D-ui.md](./D-ui.md) | C マージ済み | `core/src/ui/*`, `content.ts`, `popup/*` |
| E | [E-docs-release.md](./E-docs-release.md) | D マージ済み | `docs/*`, `README.md`, バージョン番号 |

全セッション共通のルールは [00-common.md](./00-common.md) にあります。

## ファイル担当表（競合防止）

「○」が付いたセッションだけが、そのファイルを編集できます。

| ファイル | W0 | A | B | C | D | E |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `packages/core/src/types.ts` | ○ | | | | | |
| `packages/core/src/index.ts` | ○ | | | | ○ | |
| `packages/core/src/textClassify.ts`（＋テスト） | ○ | ○ | | | | |
| `packages/core/src/textFormat.ts`（＋テスト） | ○ | ○ | | | | |
| `packages/core/src/preprocess.ts`（＋テスト） | ○ | | ○ | | | |
| `packages/core/src/ocrLanguage.ts`（＋テスト） | ○ | | ○ | | | |
| `packages/core/src/capture.ts` | | | ○ | | | |
| `packages/core/src/selection.ts` | | | | ○ | | |
| `packages/core/src/toast.ts`（削除） | | | | | ○ | |
| `packages/core/src/ui/*`（新規） | | | | | ○ | |
| `packages/core/package.json`・vitest設定 | ○ | | | | | |
| `packages/local-ocr/manifest.json` | ○ | | | ○ | | ○（version のみ） |
| `packages/local-ocr/src/background.ts` | ○ | | | ○ | | |
| `packages/local-ocr/src/content.ts` | ○ | | | ○ | ○ | |
| `packages/local-ocr/src/offscreen.ts` | ○ | | ○ | | | |
| `packages/local-ocr/src/engines/tesseractEngine.ts` | ○ | | ○ | | | |
| `packages/local-ocr/src/vite-env.d.ts`（新規）・`vite.config.ts` | | | | ○ | | |
| `packages/local-ocr/src/popup/*` | | | | | ○ | |
| ルートの `package.json` | ○ | | | | | |
| `packages/local-ocr/package.json` | | | | | | ○（version のみ） |
| `docs/*`, `README.md` | ○ | | | | | ○ |

## クラウドセッションの起動方法

### 事前準備（初回のみ）

- claude.ai/code の環境設定の「Setup script」に `pnpm install` を入れておくと、各セッションで依存パッケージのインストールを省けます（任意）
- クラウド環境には Node 22 と pnpm が最初から入っていて、npm レジストリにも既定で接続できます（公式ドキュメント: code.claude.com/docs/en/cloud-environments）
- クラウドのセッションは、ローカルの `~/.claude/CLAUDE.md`（確認を多めに取るルール）を**読み込みません**。そのため、質問せずに進めるルールは `00-common.md` に書いてあります

### 起動

1. リポジトリ `enknot96/shotext` を選び、起点のブランチに **`dev`** を選ぶ
2. モデルに **Sonnet 5** を選ぶ（選択肢に無い場合は、起動後に `/model sonnet` を実行する）
3. 下の文面の `<ID>` と `<ファイル名>` を置き換えて貼り付ける
4. セッションが自分で PR を作れなかった場合は、画面の PR 作成機能で base に `dev` を選んで作成する

```
リポジトリ enknot96/shotext の dev ブランチを起点に作業してください。
最初に次の3ファイルを読み、その指示に厳密に従ってください。
1. docs/tasks/00-common.md（全セッション共通のルール）
2. docs/tasks/<ファイル名>（このセッションのタスク: <ID>）
3. docs/SPEC-v1.1.md（仕様書）
実装が終わったら、00-common.md の「完了前チェック」をすべて通し、dev ブランチ向けの Pull Request を作成してください。
私への質問は不要です。判断が必要な箇所は 00-common.md のルールに従って自分で決め、PR本文の「判断メモ」に書いてください。
```

## レビューの流れ

1. クラウドセッションが dev 向けの PR を作成する
2. ローカルのセッション（Opus 5.5）とオーナーで PR をレビューする
3. 修正が必要な場合は、同じクラウドセッションに指摘を送って修正させる（文脈が残っているため）。軽微なものはローカルで直す
4. dev にマージしたら、次のウェーブを起動する
