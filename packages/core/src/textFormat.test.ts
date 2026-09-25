import { describe, expect, it } from "vitest";
import { joinWrappedLines } from "./textFormat";

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
