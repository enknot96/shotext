import { describe, expect, it } from "vitest";
import { formatText, joinWrappedLines } from "./textFormat";
import type { OcrLine, OcrWord } from "./types";

// v1.0.1時点の挙動を固定するテスト
// 英語の行を連結するときにスペースが入らない挙動はv1.1-Aで修正するため、ここでは扱わない
describe("joinWrappedLines", () => {
  it("日本語の折り返しを連結する", () => {
    expect(joinWrappedLines("画面の好きな範囲を\n選択するだけ")).toBe("画面の好きな範囲を選択するだけ");
  });

  it("文末記号で終わる行は改行を残す", () => {
    expect(joinWrappedLines("コピーします。\n次の文")).toBe("コピーします。\n次の文");
    expect(joinWrappedLines("本当？\n次の文")).toBe("本当？\n次の文");
    expect(joinWrappedLines("できた！\n次の文")).toBe("できた！\n次の文");
    expect(joinWrappedLines("「引用」\n次の文")).toBe("「引用」\n次の文");
  });

  it("空行（段落の区切り）を残す", () => {
    expect(joinWrappedLines("段落1\n\n段落2")).toBe("段落1\n\n段落2");
  });

  it("1行だけならそのまま返す", () => {
    expect(joinWrappedLines("一行だけ")).toBe("一行だけ");
  });
});

// テスト用のOcrLineを組み立てるヘルパー
// 各単語は「文字幅CHAR_WIDTH pxの等幅フォント」とみなし、bboxをtextから逆算する
const CHAR_WIDTH = 10;
const LINE_HEIGHT = 20;

function makeLine(wordsSpec: Array<{ text: string; x0: number }>, y0 = 0, height = LINE_HEIGHT): OcrLine {
  const words: OcrWord[] = wordsSpec.map(({ text, x0 }) => ({
    text,
    bbox: { x0, y0, x1: x0 + text.length * CHAR_WIDTH, y1: y0 + height },
  }));
  return {
    text: wordsSpec.map((w) => w.text).join(" "),
    bbox: {
      x0: Math.min(...words.map((w) => w.bbox.x0)),
      y0,
      x1: Math.max(...words.map((w) => w.bbox.x1)),
      y1: y0 + height,
    },
    words,
  };
}

describe("formatText（prose）", () => {
  it("P1: 英語の折り返しはスペースを入れて連結する", () => {
    expect(formatText({ rawText: "Hello\nworld", lines: [] }, "prose")).toBe("Hello world");
  });

  it("P2: 文中の読点で終わる行はスペースを入れて連結する", () => {
    expect(formatText({ rawText: "I went to the store,\nand bought milk.", lines: [] }, "prose")).toBe(
      "I went to the store, and bought milk."
    );
  });

  it("P3: 行末ハイフンで分割された単語を結合する", () => {
    expect(formatText({ rawText: "This is recog-\nnition test", lines: [] }, "prose")).toBe(
      "This is recognition test"
    );
  });

  it("P4: 次の行が大文字始まりならハイフンを残す", () => {
    expect(formatText({ rawText: "Well-\nKnown", lines: [] }, "prose")).toBe("Well-Known");
  });

  it("P5: 文末記号の後ろは改行を残す", () => {
    expect(formatText({ rawText: "これはテスト\nです。\n次の行", lines: [] }, "prose")).toBe(
      "これはテストです。\n次の行"
    );
  });

  it("P6: 日本語と英語が混ざる境目はスペースを入れない", () => {
    expect(formatText({ rawText: "Reactの\nコンポーネント", lines: [] }, "prose")).toBe(
      "Reactのコンポーネント"
    );
  });

  it("P7: 空行は段落の区切りとして残す", () => {
    expect(formatText({ rawText: "段落1\n\n段落2", lines: [] }, "prose")).toBe("段落1\n\n段落2");
  });

  it("P8: 日本語の文字間の余分なスペースを除去する", () => {
    expect(formatText({ rawText: "こ れ は テ ス ト", lines: [] }, "prose")).toBe("これはテスト");
  });

  it("P9: 前後が日本語でなければ全角記号を半角にする", () => {
    expect(formatText({ rawText: "Hello！", lines: [] }, "prose")).toBe("Hello!");
  });

  it("P10: 前の文字が日本語なら全角記号を変換しない", () => {
    expect(formatText({ rawText: "日本語！", lines: [] }, "prose")).toBe("日本語！");
  });

  it("P11: スマートクオートを変換する", () => {
    expect(formatText({ rawText: "He said \u201Chi\u201D", lines: [] }, "prose")).toBe('He said "hi"');
  });
});

describe("formatText（code）", () => {
  it("K1: 座標が無い場合は連結せずそのまま返す", () => {
    expect(formatText({ rawText: "const a = 1;\nconst b = 2;", lines: [] }, "code")).toBe(
      "const a = 1;\nconst b = 2;"
    );
  });

  it("K2: x座標と文字幅からインデントを推定する", () => {
    const lines: OcrLine[] = [
      makeLine([{ text: "function f() {", x0: 0 }], 0),
      makeLine([{ text: "return 1;", x0: 40 }], 20),
      makeLine([{ text: "}", x0: 0 }], 40),
    ];
    expect(formatText({ rawText: lines.map((l) => l.text).join("\n"), lines }, "code")).toBe(
      "function f() {\n    return 1;\n}"
    );
  });

  it("K3: インデント幅は偶数に丸める", () => {
    const lines: OcrLine[] = [
      makeLine([{ text: "abc", x0: 0 }], 0),
      makeLine([{ text: "def", x0: 30 }], 20),
    ];
    expect(formatText({ rawText: lines.map((l) => l.text).join("\n"), lines }, "code")).toBe("abc\n    def");
  });

  it("K4: 行番号を除去し、残った本文でインデントを推定する", () => {
    const lines: OcrLine[] = [
      makeLine(
        [
          { text: "1", x0: 0 },
          { text: "aaa", x0: 30 },
        ],
        0
      ),
      makeLine(
        [
          { text: "2", x0: 0 },
          { text: "bbb", x0: 70 },
        ],
        20
      ),
      makeLine(
        [
          { text: "3", x0: 0 },
          { text: "ccc", x0: 30 },
        ],
        40
      ),
    ];
    expect(formatText({ rawText: lines.map((l) => l.text).join("\n"), lines }, "code")).toBe(
      "aaa\n    bbb\nccc"
    );
  });

  it("K5: 行番号が増加していない場合は除去しない", () => {
    expect(formatText({ rawText: "10 apples\n3 pears", lines: [] }, "code")).toBe("10 apples\n3 pears");
  });

  it("K6: 行の間隔が広い場合は空行を復元する", () => {
    const lines: OcrLine[] = [
      makeLine([{ text: "aaa", x0: 0 }], 0),
      makeLine([{ text: "bbb", x0: 0 }], 45),
    ];
    expect(formatText({ rawText: lines.map((l) => l.text).join("\n"), lines }, "code")).toBe(
      "aaa\n\nbbb"
    );
  });

  it("K7: 全角英数字・記号を半角にする", () => {
    expect(formatText({ rawText: "\uff43\uff4f\uff4e\uff53\uff54\u3000\uff41\u3000\uff1d\u3000\uff11\uff1b", lines: [] }, "code")).toBe(
      "const a = 1;"
    );
  });

  it("K8: スマートクオートを変換する", () => {
    expect(formatText({ rawText: "print(\u201Chi\u201D)", lines: [] }, "code")).toBe('print("hi")');
  });
});

describe("formatText（terminal）", () => {
  it("T1: $プロンプトを除去する", () => {
    expect(formatText({ rawText: "$ npm install\n$ npm run dev", lines: [] }, "terminal")).toBe(
      "npm install\nnpm run dev"
    );
  });

  it("T2: PowerShellのプロンプトを除去する", () => {
    expect(formatText({ rawText: "PS C:\\Users\\me> dir", lines: [] }, "terminal")).toBe("dir");
  });

  it("T3: プロンプトの無い行（出力）はそのまま残す", () => {
    expect(formatText({ rawText: "$ ls\nsrc  package.json", lines: [] }, "terminal")).toBe(
      "ls\nsrc  package.json"
    );
  });
});

describe("formatText（空文字）", () => {
  it("空文字を渡すと空文字を返す", () => {
    expect(formatText({ rawText: "", lines: [] }, "prose")).toBe("");
    expect(formatText({ rawText: "", lines: [] }, "code")).toBe("");
    expect(formatText({ rawText: "", lines: [] }, "terminal")).toBe("");
  });
});
