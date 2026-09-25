import { describe, expect, it } from "vitest";
import { classifyText } from "./textClassify";

describe("classifyText", () => {
  it("C1: 関数定義はcode", () => {
    expect(classifyText("function add(a, b) {\n  return a + b;\n}")).toBe("code");
  });

  it("C2: Pythonの関数定義と呼び出しはcode", () => {
    expect(classifyText("def add(a, b):\n    return a + b\n\nprint(add(1, 2))")).toBe("code");
  });

  it("C3: 英語の説明文はprose", () => {
    expect(
      classifyText(
        "This extension lets you select an area\nof the screen and copy the text\nstraight to your clipboard."
      )
    ).toBe("prose");
  });

  it("C4: 日本語の説明文はprose", () => {
    expect(
      classifyText("画面の好きな範囲を選択するだけで\n文字を認識し、クリップボードに\nコピーしてくれます。")
    ).toBe("prose");
  });

  it("C5: $プロンプトが全行ならterminal", () => {
    expect(classifyText("$ npm install\n$ npm run dev")).toBe("terminal");
  });

  it("C6: 4行中2行がプロンプトならterminal", () => {
    expect(classifyText("$ ls\nsrc  package.json\n$ pwd\n/home/me")).toBe("terminal");
  });

  it("C7: 空文字はprose", () => {
    expect(classifyText("")).toBe("prose");
  });

  it("C8: 'for example'を含む英文はproseのまま（if/for/whileの誤判定を避ける）", () => {
    expect(classifyText("I went to the store,\nand bought some milk\nfor example.")).toBe("prose");
  });

  it("C9: 行番号付きのコードはcode", () => {
    expect(classifyText('1 import React from "react";\n2 \n3 export default App;')).toBe("code");
  });
});
