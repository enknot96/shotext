import type { OcrLine, OcrOutput, TextType } from "./types";

// 文末の句読点・記号で終わっていない行は、Webページの折り返しによる見た目の改行とみなして連結する
const SENTENCE_END_PATTERN = /[。！？!?」』）)"']$/;

// 日本語の文字（CJK記号・句読点、ひらがな、カタカナ、CJK統合漢字、拡張A、半角カナ）
const JP_CHAR = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF66-\uFF9F]/;
// ターミナルのプロンプト（$ / % / > / PowerShellの"PS C:\path>"）
const PROMPT_RE = /^\s*(?:\$|%|>|PS [^>\n]*>)\s+/;

// 日本語の文字同士の間にある、余分な半角スペース・タブ
const JP_SPACE_BETWEEN_RE =
  /([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF66-\uFF9F])[ \t]+(?=[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF66-\uFF9F])/g;

const FULLWIDTH_SPACE = "\u3000";
const SMART_QUOTES: Record<string, string> = {
  "\u201C": '"', // “
  "\u201D": '"', // ”
  "\u2018": "'", // ‘
  "\u2019": "'", // ’
};

function isJpChar(ch: string | undefined): boolean {
  return ch !== undefined && JP_CHAR.test(ch);
}

// 日本語の文字同士の間にある余分な空白を除去する
function removeSpaceBetweenJp(text: string): string {
  return text.replace(JP_SPACE_BETWEEN_RE, "$1");
}

// 全角英数字・記号を半角にし、スマートクオートを変換する
// prose: 変換対象の前後どちらかが日本語の文字なら変換しない（文中の記号を残すため）
function convertFullwidthAndQuotes(text: string, skipNearJp: boolean): string {
  const chars = Array.from(text);
  return chars
    .map((ch, i) => {
      if (skipNearJp && (isJpChar(chars[i - 1]) || isJpChar(chars[i + 1]))) {
        return ch;
      }
      if (ch === FULLWIDTH_SPACE) return " ";
      const code = ch.codePointAt(0) ?? 0;
      if (code >= 0xff01 && code <= 0xff5e) {
        return String.fromCodePoint(code - 0xfee0);
      }
      return SMART_QUOTES[ch] ?? ch;
    })
    .join("");
}

// 全タイプ共通で最後に適用する正規化
function applyCommonNormalization(text: string, type: TextType): string {
  const withoutJpSpace = removeSpaceBetweenJp(text);
  return convertFullwidthAndQuotes(withoutJpSpace, type === "prose");
}

// OCRで見た目上折り返された行を、元の文として連結する
export function joinWrappedLines(text: string): string {
  const lines = text.split("\n").map((line) => line.replace(/[ \t]+$/, ""));
  let result = lines[0] ?? "";

  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i];
    const next = lines[i + 1];
    const nextHead = next.replace(/^[ \t]+/, "");

    if (current.trim() === "" || next.trim() === "") {
      result += "\n" + next;
      continue;
    }
    if (SENTENCE_END_PATTERN.test(current)) {
      result += "\n" + next;
      continue;
    }
    // ハイフネーションで分割された英単語を結合する（recog- + nition → recognition）
    if (/[A-Za-z]-$/.test(current) && /^[a-z]/.test(nextHead)) {
      result = result.slice(0, -1) + nextHead;
      continue;
    }
    if (current.endsWith("-")) {
      result += nextHead;
      continue;
    }
    if (isJpChar(current.slice(-1)) || isJpChar(nextHead.slice(0, 1))) {
      result += nextHead;
      continue;
    }
    result += " " + nextHead;
  }

  return result;
}

// 行頭のエディタ行番号（例: "12 const x = 1;"）
const LINE_NUMBER_RE = /^\s*(\d+)(?:\s+|$)/;

// 空でない行の8割以上が行番号を持ち、かつその番号が狭義単調増加の場合だけ除去する
function shouldStripLineNumbers(texts: string[]): boolean {
  const nonEmpty = texts.filter((text) => text.trim() !== "");
  if (nonEmpty.length === 0) return false;

  const numbers: number[] = [];
  for (const text of nonEmpty) {
    const match = LINE_NUMBER_RE.exec(text);
    if (match) numbers.push(Number(match[1]));
  }
  if (numbers.length / nonEmpty.length < 0.8) return false;

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] <= numbers[i - 1]) return false;
  }
  return true;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// 座標情報が無い場合のコード整形: 連結やインデント推定はせず、行番号だけ除去する
function formatCodeWithoutLines(rawText: string): string {
  const lines = rawText.split("\n");
  if (!shouldStripLineNumbers(lines)) return lines.join("\n");
  return lines.map((line) => line.replace(LINE_NUMBER_RE, "")).join("\n");
}

// 座標情報がある場合のコード整形: 行番号除去、インデント推定、空行の復元を行う
function formatCodeWithLines(lines: OcrLine[]): string {
  const strip = shouldStripLineNumbers(lines.map((line) => line.text));
  const processedLines = strip
    ? lines.map((line) => {
        if (!LINE_NUMBER_RE.test(line.text)) return line;
        return {
          ...line,
          text: line.text.replace(LINE_NUMBER_RE, ""),
          words: line.words.slice(1),
        };
      })
    : lines;

  const allWords = processedLines.flatMap((line) => line.words);
  const charWidth =
    allWords.length > 0
      ? median(allWords.map((word) => (word.bbox.x1 - word.bbox.x0) / word.text.length))
      : undefined;

  const contentXs = processedLines.map((line) =>
    line.words.length > 0 ? line.words[0].bbox.x0 : line.bbox.x0
  );
  const baseX = Math.min(...contentXs);

  const indentedTexts = processedLines.map((line, i) => {
    if (charWidth === undefined) return line.text;
    const bodyText = line.text.replace(/^[ \t]+/, "");
    const cols = Math.round((contentXs[i] - baseX) / charWidth);
    const evenCols = Math.round(cols / 2) * 2;
    return " ".repeat(evenCols) + bodyText;
  });

  const lineHeight = median(processedLines.map((line) => line.bbox.y1 - line.bbox.y0));

  const outputLines: string[] = [];
  for (let i = 0; i < processedLines.length; i++) {
    outputLines.push(indentedTexts[i].replace(/[ \t]+$/, ""));
    if (i < processedLines.length - 1) {
      const gap = processedLines[i + 1].bbox.y0 - processedLines[i].bbox.y1;
      if (gap > lineHeight * 0.8) outputLines.push("");
    }
  }

  return outputLines.join("\n");
}

// ターミナルのプロンプト記号を除去する（出力行はそのまま残す）
function formatTerminal(rawText: string): string {
  return rawText
    .split("\n")
    .map((line) => line.replace(PROMPT_RE, ""))
    .join("\n");
}

// OCR結果を、判定したタイプに合わせて整形する
export function formatText(input: Pick<OcrOutput, "rawText" | "lines">, type: TextType): string {
  let body: string;
  if (type === "prose") {
    body = joinWrappedLines(input.rawText);
  } else if (type === "code") {
    body =
      input.lines.length === 0 ? formatCodeWithoutLines(input.rawText) : formatCodeWithLines(input.lines);
  } else {
    body = formatTerminal(input.rawText);
  }
  return applyCommonNormalization(body, type);
}
