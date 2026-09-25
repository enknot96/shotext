import type { OcrOutput, TextType } from "./types";

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
      result += "\n";
    }
  }

  return result;
}

// OCR結果を、判定したタイプに合わせて整形する
// TODO(v1.1-A): タイプ別の整形ルールを実装する。現時点では文章だけ従来どおり折り返しを連結する
export function formatText(input: Pick<OcrOutput, "rawText" | "lines">, type: TextType): string {
  if (type === "prose") {
    return joinWrappedLines(input.rawText);
  }
  return input.rawText;
}
