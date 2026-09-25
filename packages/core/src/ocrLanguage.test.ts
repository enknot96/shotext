import { describe, expect, it } from "vitest";
import { langsForUiLanguage } from "./ocrLanguage";

describe("langsForUiLanguage", () => {
  it("日本語環境ではjpn+engを返す", () => {
    expect(langsForUiLanguage("ja")).toBe("jpn+eng");
    expect(langsForUiLanguage("ja-JP")).toBe("jpn+eng");
    expect(langsForUiLanguage("JA")).toBe("jpn+eng");
  });

  it("それ以外はengだけ返す", () => {
    expect(langsForUiLanguage("en-US")).toBe("eng");
    expect(langsForUiLanguage("fr")).toBe("eng");
    expect(langsForUiLanguage("")).toBe("eng");
  });
});
