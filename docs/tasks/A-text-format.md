# A: 文章/コード/ターミナルの判定と整形

- 着手条件: W0 が dev にマージ済み
- 対応するSPEC: 4.2、4.3
- 編集してよいファイル（これ以外は禁止）
  - `packages/core/src/textClassify.ts`
  - `packages/core/src/textFormat.ts`
  - `packages/core/src/textClassify.test.ts`（新規）
  - `packages/core/src/textFormat.test.ts`（W0 のテストに追記する）
- 追加してよい依存パッケージ: なし

## ゴール

W0 で作ったスタブ `classifyText` と `formatText` を、シグネチャを変えずに本実装へ置き換える。どちらも**純粋な関数**（DOM や chrome API に依存しない）にし、テストで挙動を保証する。

```ts
classifyText(rawText: string): TextType
formatText(input: Pick<OcrOutput, "rawText" | "lines">, type: TextType): string
```

- `joinWrappedLines` は export したまま残す（W0 のテストが参照しているため）。中身は下の「prose」のルールに更新してよい
- 空文字を渡されても例外を出さず、`classifyText` は `"prose"`、`formatText` は `""` を返す

## 共通の定義

```ts
// 日本語の文字（CJK記号・句読点、ひらがな、カタカナ、CJK統合漢字、拡張A、半角カナ）
const JP_CHAR = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF66-\uFF9F]/;
// ターミナルのプロンプト（$ / % / > / PowerShell の "PS C:\path>"）
const PROMPT_RE = /^\s*(?:\$|%|>|PS [^>\n]*>)\s+/;
```

## classifyText の判定ルール

1. `rawText` を行に分け、空行（空白だけの行を含む）を除いた行数を `n` とする。`n === 0` なら `"prose"` を返す
2. **terminal**: `PROMPT_RE` に一致し、かつプロンプトの後ろに文字がある行が `Math.ceil(n / 2)` 行以上あれば `"terminal"` を返す
3. **code**: 各行の先頭にある行番号（`/^\s*\d+\s+/`）を除いてから、次のどれかに当てはまる行を「コードらしい行」と数える。その割合が `0.4` 以上なら `"code"` を返す
   - 行末が `{ } [ ] ( ) ;` のどれか（後ろの空白は無視する）
   - 行頭が `} ] )` のどれか
   - 行頭のキーワード（大文字・小文字を区別する）: `const` `let` `var` `function` `def` `class` `import` `export` `return` `elif` `async` `await` `public` `private` `protected` `static` `fn` `func` `package` `interface` `try` `catch` `#include`
   - 行頭の `if` / `for` / `while` の直後に `(` が続く（英文の途中で改行された行の、小文字の `for example` などを誤判定しないため）
   - 行内に `=>` `===` `!==` `::` `->` `++` `&&` `||` を含む。または `識別子()` や `obj.method(` の形を含む（`/\w\(\)/`、`/\w\.\w+\(/`）
   - 行頭がコメントやHTMLタグ（`//`、`/*`、`* `、`<tag`、`</tag`）
   - 行頭が代入の形（`/^\s*[\w.]+\s*=\s*\S/`）
4. どれにも当てはまらなければ `"prose"`

判定の優先順は terminal → code → prose とする。

## formatText の整形ルール

### 共通の正規化（全タイプで最後に適用する）

次の順番で適用する。

1. 日本語の文字と文字の間にある空白（スペース・タブ）を除去する: `/(JP_CHAR)[ \t]+(?=JP_CHAR)/g` → `"$1"`
2. 全角の英数字・記号（U+FF01〜FF5E）を半角にする（コードポイントから `0xFEE0` を引く）。全角スペース（U+3000）は半角スペースにする
3. スマートクオートを変換する: `“ ”` → `"`、`‘ ’` → `'`

- `code` と `terminal` では、2と3を常に適用する
- `prose` では、**直前か直後の文字が `JP_CHAR` の場合は2と3を適用しない**（日本語の文中の `！` や `“”` を残すため）

### prose（文章）

行ごとに末尾の空白を除いたうえで、隣の行とのつなぎ方を上から順に判定する。

| 条件 | つなぎ方 |
|---|---|
| どちらかの行が空行（段落の区切り） | 改行を残す |
| 行末が文末記号（既存の `SENTENCE_END_PATTERN`） | 改行を残す |
| 行末が `/[A-Za-z]-$/` で、次の行の先頭が英小文字 | 行末の `-` を削除し、空白を入れずに連結する（ハイフネーションの復元） |
| 行末が `-`（上の条件に当てはまらない場合） | `-` を残したまま、空白を入れずに連結する |
| 行末の文字か、次の行の先頭の文字が `JP_CHAR` | 空白を入れずに連結する |
| 上のどれにも当てはまらない | **半角スペースを1つ入れて**連結する |

- 連結するときは、次の行の先頭の空白を除く

### code（コード）

**`input.lines` が空の場合**（座標が無い場合）

- `rawText` の行をそのまま使う（連結しない、インデントの推定もしない）。行番号の除去だけ行う

**`input.lines` がある場合**

1. **行番号の除去**
   - 空でない行のうち、`/^\s*(\d+)(?:\s+|$)/` に一致する行の割合を求める
   - 割合が `0.8` 以上で、かつ一致した番号が**狭義単調増加**（前の行より必ず大きい）の場合だけ除去する
   - 除去するときは、行テキストから番号と後ろの空白を消し、`words` の先頭の単語（番号）も座標の計算から外す
2. **インデントの推定**
   - 文字幅 `charWidth`: 全単語の `(bbox.x1 - bbox.x0) / text.length` の**中央値**。単語が1つも無ければ、インデントの推定はしない
   - 各行の本文の開始位置 `contentX`: 行番号を除いた後の、最初の単語の `bbox.x0`（単語が無ければ `line.bbox.x0`）
   - 基準位置 `baseX`: 全行の `contentX` の最小値
   - インデント幅: `cols = Math.round((contentX - baseX) / charWidth)` を求め、`Math.round(cols / 2) * 2` で**偶数に丸める**。その数だけ半角スペースを行頭に付ける（行テキストの先頭の空白は除いてから付ける）
3. **空行の復元**（Tesseract の行一覧には空行が含まれないため）
   - 行の高さの中央値 `lineHeight` を求める（`bbox.y1 - bbox.y0`）
   - 次の行の `bbox.y0` と、今の行の `bbox.y1` の差が `lineHeight * 0.8` より大きければ、間に空行を1つ入れる
4. 各行の末尾の空白を除き、改行でつなぐ

### terminal（ターミナル）

- `rawText` の各行から `PROMPT_RE` に一致する部分を除く。プロンプトの無い行（コマンドの出力）はそのまま残す
- 行は連結しない

## 必須のテストケース

入力と期待値は、このとおりにテストを書くこと（これ以外に追加するのは自由）。`OcrLine` を組み立てるテスト用のヘルパー関数を、テストファイルの中に作ってよい。

### classifyText

| # | 入力 | 期待値 |
|---|---|---|
| C1 | `"function add(a, b) {\n  return a + b;\n}"` | `code` |
| C2 | `"def add(a, b):\n    return a + b\n\nprint(add(1, 2))"` | `code` |
| C3 | `"This extension lets you select an area\nof the screen and copy the text\nstraight to your clipboard."` | `prose` |
| C4 | `"画面の好きな範囲を選択するだけで\n文字を認識し、クリップボードに\nコピーしてくれます。"` | `prose` |
| C5 | `"$ npm install\n$ npm run dev"` | `terminal` |
| C6 | `"$ ls\nsrc  package.json\n$ pwd\n/home/me"` | `terminal`（4行中2行がプロンプト） |
| C7 | `""` | `prose` |
| C8 | `"I went to the store,\nand bought some milk\nfor example."` | `prose` |
| C9 | `"1 import React from \"react\";\n2 \n3 export default App;"` | `code` |

### formatText（prose）

| # | 入力 `rawText` | 期待値 |
|---|---|---|
| P1 | `"Hello\nworld"` | `"Hello world"` |
| P2 | `"I went to the store,\nand bought milk."` | `"I went to the store, and bought milk."` |
| P3 | `"This is recog-\nnition test"` | `"This is recognition test"` |
| P4 | `"Well-\nKnown"` | `"Well-Known"` |
| P5 | `"これはテスト\nです。\n次の行"` | `"これはテストです。\n次の行"` |
| P6 | `"Reactの\nコンポーネント"` | `"Reactのコンポーネント"` |
| P7 | `"段落1\n\n段落2"` | `"段落1\n\n段落2"` |
| P8 | `"こ れ は テ ス ト"` | `"これはテスト"` |
| P9 | `"Hello！"` | `"Hello!"` |
| P10 | `"日本語！"` | `"日本語！"`（前の文字が日本語なので変換しない） |
| P11 | `"He said “hi”"` | `"He said \"hi\""` |

### formatText（code）

| # | 入力 | 期待値 |
|---|---|---|
| K1 | `rawText: "const a = 1;\nconst b = 2;"`、`lines: []` | 入力と同じ |
| K2 | 3行。文字幅10px。1行目 `function f() {` は x0=0、2行目 `return 1;` は x0=40、3行目 `}` は x0=0 | `"function f() {\n    return 1;\n}"` |
| K3 | 2行。文字幅10px。1行目は x0=0、2行目は x0=30（3文字分） | 2行目のインデントが4スペース（偶数への丸め） |
| K4 | 行番号付き3行（`1`〜`3`）。番号の単語は x0=0、本文は1・3行目が x0=30、2行目が x0=70 | 番号が消え、2行目だけインデントが4スペース |
| K5 | `rawText: "10 apples\n3 pears"`、`lines: []` | 入力と同じ（番号が増加していないので消さない） |
| K6 | 2行。1行目の y0=0・y1=20、2行目の y0=45・y1=65（行の高さ20、差25 > 16） | 2行の間に空行が1つ入る |
| K7 | `rawText: "ｃｏｎｓｔ　ａ　＝　１；"`、`lines: []` | `"const a = 1;"` |
| K8 | `rawText: "print(“hi”)"`、`lines: []` | `"print(\"hi\")"` |

### formatText（terminal）

| # | 入力 `rawText` | 期待値 |
|---|---|---|
| T1 | `"$ npm install\n$ npm run dev"` | `"npm install\nnpm run dev"` |
| T2 | `"PS C:\\Users\\me> dir"` | `"dir"` |
| T3 | `"$ ls\nsrc  package.json"` | `"ls\nsrc  package.json"` |

## 受入条件

- 上の必須テストケースがすべて通る
- W0 で書いた `joinWrappedLines` のテストも、引き続きすべて通る
- `pnpm check` が成功する
- 編集したのは「編集してよいファイル」だけ
