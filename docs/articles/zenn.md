---
title: "スクショした文字をコピペしたくて、Chrome拡張機能「ショッテキ！」を作った"
emoji: "📸"
type: "tech"
topics: ["chrome拡張", "tesseractjs", "typescript", "ocr", "個人開発"]
published: false
---

## きっかけ

YouTubeのプログラミング解説動画を見ながら写経して勉強しているとき、地味に面倒な作業がありました。

動画の中で「このプロンプトをAIに渡してください」というシーンが出てくるのですが、そのプロンプト自体はどこにも配布されていない。仕方なく、

1. 動画の該当シーンでスクショを撮る
2. Claudeにアップロードする
3. 「この画像の文字を書き出して」と頼んで文字起こしする

……ということを何度も繰り返していました。さすがに毎回これをやるのは面倒くさすぎる。「画面の一部を選択したら、その場でテキストになってクリップボードに入ってくれればいいのに」と思ったのが、この拡張機能を作ったきっかけです。

## 作ったもの

**「ショッテキ！ / ShoText！」** という名前のChrome拡張機能です。

- `Alt+Shift+D` を押して、画面の好きな範囲をドラッグで選択する
- 選択範囲の中の文字を自動でOCR（文字認識）する
- 認識したテキストが自動でクリップボードにコピーされる

これだけです。OCRは[Tesseract.js](https://github.com/naptha/tesseract.js)（WebAssembly版のTesseract）を使い、**すべてブラウザ内でローカルに処理**しています。画像も認識結果も、どこにも送信されません。

- リポジトリ: https://github.com/enknot96/shotext

## 技術構成

pnpm workspaceのmonorepoで、

- `packages/core`: 範囲選択UI・画像切り抜き・トースト通知など、拡張機能に依存しない共通ロジック
- `packages/local-ocr`: Tesseract.jsを使ったローカルOCR版の拡張機能本体

という2パッケージ構成にしています。ビルドはVite + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)です。

以降は、作りながらぶつかった「なるほど」ポイントをいくつか書いていきます。

## `new Promise`の引数って結局何なんだ問題

範囲選択のオーバーレイを出す処理は、こう書いています。

```ts
export function startSelectionOverlay(): Promise<SelectionRect | null> {
  return new Promise((resolve) => {
    // オーバーレイのdivを作る...

    function onMouseUp(event: MouseEvent) {
      // ...
      cleanup();
      resolve(rect);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cleanup();
        resolve(null);
      }
    }

    overlay.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
  });
}
```

書いている途中で「これ`async`にすればもっとスッキリ書けるんじゃないか？」と思ったのですが、それより手前で引っかかったことがありました。**`new Promise(...)`に渡しているこの引数、そもそも何なんだ？**という点です。

まず整理したのは、関数の書き方には何パターンかあるということでした。

```ts
function test(example) { /* ... */ }   // 名前付き関数。後から test(...) と呼び出せる
function (example) { /* ... */ }        // 無名関数。名前が無いのでその場でしか使えない
(example) => { /* ... */ }              // アロー関数。これも無名関数の一種
```

`new Promise((resolve) => {...})`の`(resolve) => {...}`は、この3番目の**無名のアロー関数**です。`new Promise`は「関数を1個、丸ごと引数として受け取る」という決まりになっています。つまり`(...)`の中に入っているのは値ではなく、**関数そのもの**です。

ここまでは字面として理解できるのですが、本当に腑に落ちたのは次の点でした。

**この`(resolve) => {...}`という関数が実際に呼び出された瞬間（＝`new Promise(...)`が実行された瞬間）、引数`resolve`の中には、Promiseの仕組みが用意した「特別な関数」がすでに入っている**ということです。

自分で`resolve`という関数を定義しているわけではありません。`new Promise`を呼ぶと、Promiseの仕組み側が「これを呼んだらPromiseを完了させられるよ」という関数をあらかじめ作って、渡してきてくれるのです。名前は`resolve`である必要すらなく、試しに`example`という名前にしても全く同じように動きます。

```ts
return new Promise((example) => {
  // example は「Promiseを完了させる特別な関数」
  overlay.addEventListener("mouseup", (event) => {
    const rect = { x: /* ... */, y: /* ... */, width: /* ... */, height: /* ... */ };
    example(rect); // ← ここで初めて「pending」から「fulfilled」に変わる
  });
});
```

その「特別な関数」を呼ぶと、

1. Promiseの状態が pending（保留中）→ fulfilled（完了）に変わる
2. その時に渡した値（`rect`）が、Promiseの「結果」として確定する
3. 呼び出し元で`await startSelectionOverlay()`と書いて待っていた場所に、その値がそのまま返ってくる

という流れが起きます。実際のコードでは、ユーザーがマウスを離した瞬間（`mouseup`イベント）に`resolve(rect)`を呼んでいて、これが`content.ts`側の`await startSelectionOverlay()`に選択範囲の座標を届けています。

```ts
// selection.ts 側
function onMouseUp(event: MouseEvent) {
  const rect: SelectionRect = { /* ... */ };
  resolve(rect); // Promiseをfulfilledにする
}

// content.ts 側
const rect = await startSelectionOverlay(); // resolve(rect)された値がここに入る
```

「`resolve`は自分で作った関数じゃなくて、Promiseの仕組みが用意して渡してくれる関数だった」と気づいたのが、この実装で一番腑に落ちた瞬間でした。

## ユーザーがタブを切り替えてしまった時の罠

範囲選択が終わったあと、実際の処理はこう流れます。

1. `content.ts` → `background.ts` に「選択が終わったよ」と通知
2. `background.ts` が `chrome.tabs.captureVisibleTab()` で画面を撮影
3. 撮影した画像をOCRにかける

この2と3の間には（非同期処理なので）わずかにタイムラグがあります。実装している途中で「その間にユーザーが別のタブをクリックしたらどうなる？」と気づきました。そのままだと、選択したつもりのないタブの画面をキャプチャしてしまう可能性があります。

対策として、キャプチャの直前にもう一度アクティブなタブを確認し、選択開始時に記録したタブIDと比較しています。

```ts
async function handleSelectionDone(rect: SelectionRect, devicePixelRatio: number) {
  // スクショが完了した後、画面全体を撮る前に、タブが切り替わっていないか再度確認
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTab.id !== activeTabId) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/warning128.png"),
      title: "スクショOCR",
      message: "タブが切り替わったため中断しました。もう一度お試しください。",
    });
    return;
  }
  // ここまで来て初めて撮影する
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
  // ...
}
```

「非同期処理の間に前提条件が変わっているかもしれない」というのは、UIイベントを起点にした拡張機能開発では地味に見落としがちなポイントだと思います。

## Tesseract.jsのワーカーを毎回作り直していた話

最初の実装では、OCRを実行する関数の中で毎回`createWorker()`していました。

```ts
async recognize(imageBlob: Blob): Promise<OcrResult> {
  const worker = await createWorker("jpn", 1, { ... }); // 毎回ここでロード
  const { data } = await worker.recognize(imageBlob);
  await worker.terminate();
  // ...
}
```

動くには動くのですが、スクショしてからテキストがコピーされるまでが妙に遅い。原因を探して[tesseract.jsの公式パフォーマンスドキュメント](https://github.com/naptha/tesseract.js/blob/master/docs/performance.md)を読んだところ、こう書かれていました。

> create/load/destroy a new worker for each image... is never the correct option.

まさに自分がやっていたことでした。`createWorker()`はWASMコアと辞書データを毎回ロードし直す重い処理で、複数回OCRするなら1度作ったワーカーを使い回すのが正解とのことでした。そこで、ワーカーの初期化をインスタンス内に1回だけキャッシュする形に直しました。

```ts
export class TesseractEngine implements OcrEngine {
  private workerPromise: Promise<Worker> | null = null;

  private async getWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker("jpn+eng", 1, { ... }).then(async (worker) => {
        await worker.setParameters({ preserve_interword_spaces: "1" });
        return worker;
      });
    }
    return this.workerPromise;
  }

  async recognize(imageBlob: Blob): Promise<OcrResult> {
    const worker = await this.getWorker(); // 2回目以降は作り直さない
    const { data } = await worker.recognize(imageBlob);
    // ...
  }
}
```

2回目以降のOCRが明らかに速くなりました。ライブラリを使うときは、READMEだけでなく`docs/`配下のパフォーマンスやベストプラクティス系のドキュメントまで目を通す価値があるなと実感しました。

## 日本語OCRの「文字ごとに半角スペース」問題

日本語をOCRすると、こんな感じで一文字ごとに半角スペースが入ってしまう問題が起きました。

```
シ ョ ッ テ キ ！
```

英語は問題なかっただけに、なぜ日本語だけこうなる...？

[Tesseract公式リポジトリのIssue](https://github.com/tesseract-ocr/tesseract/issues)を調べ、Claudeにも聞いてみると、`preserve_interword_spaces`という設定が関係していることが分かりました。

```ts
// 0から1へ変更
await worker.setParameters({ preserve_interword_spaces: "1" });
```

はて、`preserve_interword_spaces`とは？

実際に[tesseract-ocr/tesseract本体のソースコード](https://github.com/tesseract-ocr/tesseract/blob/main/src/ccmain/resultiterator.cpp)を覗いてみると、こう書かれていましたよ。

```cpp
int numSpaces = preserve_interword_spaces_ ? it_->word()->word->space() : (words_appended > 0);
```

う〜ん、全然わからん。

ということで、Claudeさんに解説してもらうと、

「OCR結果のテキストを組み立てるとき、単語の前にスペースを何個入れるかを決める設定であり、デフォルト（0）の場合、画像上で実際の隙間がどれくらいだったかは見ておらず、単語と単語の間には無条件で1個スペースを入れる」

という設定だということが分かりました。

Tesseractは内部的に、文字（またはその集まり）を1つの「単語」として扱っており、日本語の文章では、隣り合う文字同士の隙間はほぼ0なのですが、デフォルト設定だとその実際の隙間を無視して、単語ごとに一律1スペース差し込んでしまう。

これが、一文字ごとに半角スペースが入っていた原因でした。

そのため、`preserve_interword_spaces: "1"`にすると、`numSpaces`は`it_->word()->word->space()`となり、実際に検出された隙間の大きさを使うようになってくれます。

日本語の文字間はほぼ0なので、これで余計なスペースが入らなくなりました。もしかすると、等幅フォントだと隙間が出ちゃうかもしれません。

これでかなり改善しました。

## 誤字はまだ残っていた：使っていたtraineddataが実は無駄に重かった

`preserve_interword_spaces`でスペース問題は解決したものの、それでもたまに「AIエージェント」が「Aエージェント」になるなど、誤字が残る問題がありました。

さらに調べると、デフォルトで使っていた`jpn.traineddata`（`4.0.0`）は、実はレガシーエンジンとLSTMエンジンが合体した16MBのデータで、このプロジェクトはLSTM専用モード（`OEM=1`）しか使っていないのに、使わないレガシー用データまで毎回読み込んでいたことが分かりました。

そこで、LSTM専用の高精度・軽量版（`4.0.0_best_int`、圧縮後2MB）に切り替えたところ、認識精度が上がり、拡張機能自体のサイズも軽くなりました（zipで14.7MB→9.45MB）。

めでたし、めでたし。

## 見た目の改行が、そのままコピーされてしまう問題

もう一つ、スクショした範囲を選択してコピーすると、こんな感じで**Webページ上の見た目の折り返し位置**でそのまま改行が入ってしまう問題がありました。

```
営業時代に培った顧客対応や業務プロセスの知見は、エンジニアとしての
仕事、そして、AIエージェントの判断ロジックにも活かしています。
```

本来は1文として続いているのに、Webページが表示幅に合わせて折り返しているだけの位置で、コピー結果にも改行がそのまま入ってしまいます。これはOCR自体は正しく動いていて、「画像として見えている行」を忠実にテキストの行として書き出しているだけなのですが、使う側としては「地の文なら1文としてつながっていて欲しい」ケースがほとんどでした。

そこで、句点（。！？など）で終わっていない行は改行を消して次の行と連結し、逆に句点で終わっている行や、空行（段落の区切り）はそのまま残す、という後処理を書きました。

```ts
// 文末の句読点・記号で終わっていない行は、Webページの折り返しによる見た目の改行とみなして連結する
const SENTENCE_END_PATTERN = /[。！？!?」』）)"']$/;

export function joinWrappedLines(text: string): string {
  const lines = text.split("\n");
  let result = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result += line;

    const isLastLine = i === lines.length - 1;
    if (isLastLine) {
      break;
    }

    const nextLine = lines[i + 1];
    const isParagraphBreak = line.trim() === "" || nextLine.trim() === "";
    const endsWithSentenceEnd = SENTENCE_END_PATTERN.test(line.trimEnd());

    if (isParagraphBreak || endsWithSentenceEnd) {
      result += "\n"; // 段落の区切り、または文末なので改行を残す
    }
    // どちらでもなければ、改行を入れずにそのまま次の行を連結する
  }

  return result;
}
```

1行ずつ見ていって、「次の行との間に改行を残すべきか」を判定しているだけのシンプルな処理です。残す条件は2つ、

- 今の行、または次の行が空行（＝段落の区切り）
- 今の行が句点などの文末記号で終わっている（＝ここで本当に文が終わっている）

のどちらかに当てはまる場合だけで、それ以外はスペースも入れずにそのまま連結します。日本語は単語間にスペースを入れないので、単純に文字列としてくっつけるだけで自然な1文に戻ります。

同じ「日本語のテキストがおかしい」という症状でも、原因は3つ（スペース設定・モデルの種類・改行の扱い）に分かれていて、それぞれ別の対処が必要だったのが面白かったポイントです。

## クリップボード許可ポップアップの正体

もう一つ、実装当初に「コピーが完了した瞬間、画面左上にクリップボード許可のポップアップが出る」という現象がありました。

原因は、`navigator.clipboard.writeText()`が実行されるタイミングでした。OCR処理は非同期でしばらく時間がかかるため、実行される頃には「ユーザーが操作した直後」という状態（トランジェント・アクティベーション）が切れてしまっており、ブラウザが警告を出していたのでした。

`manifest.json`の`permissions`に`clipboardWrite`を追加することで解決しました。この権限を宣言しておくと、ユーザー操作からの経過時間を問わず、警告なしでクリップボードに書き込めるようになります。

```json
"permissions": ["activeTab", "offscreen", "notifications", "clipboardWrite"]
```

## おわりに

「動画のプロンプトをスクショしてClaudeに文字起こしさせる」という地味な手間を解消したくて作った拡張機能でしたが、作る過程でPromiseの使い分け、非同期処理中の状態変化、ライブラリのパフォーマンス特性、OCRモデルの違いなど、思っていたより多くの学びがありました。

ソースは公開しているので、気になる方はぜひ見てみてください。

https://github.com/enknot96/shotext
