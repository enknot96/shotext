import type { TextType } from "./types";

// ターミナルのプロンプト（$ / % / > / PowerShellの"PS C:\path>"）
const PROMPT_RE = /^\s*(?:\$|%|>|PS [^>\n]*>)\s+/;

// classifyText専用: コード行らしさを判定する前に、エディタの行番号を取り除く
const LEADING_LINE_NUMBER_RE = /^\s*\d+\s+/;

const CODE_TRAILING_RE = /[{}\[\]();]\s*$/;
const CODE_LEADING_CLOSE_RE = /^\s*[}\])]/;
const CODE_KEYWORD_RE =
  /^\s*(?:const|let|var|function|def|class|import|export|return|elif|async|await|public|private|protected|static|fn|func|package|interface|try|catch|#include)\b/;
// if/for/whileはキーワードと違い、直後に"("が続く場合だけコードらしいとみなす（"for example"などの英文を誤判定しないため）
const CODE_CONTROL_RE = /^\s*(?:if|for|while)\s*\(/;
const CODE_OPERATOR_RE = /=>|===|!==|::|->|\+\+|&&|\|\|/;
const CODE_CALL_RE = /\w\(\)|\w\.\w+\(/;
const CODE_COMMENT_OR_TAG_RE = /^\s*(?:\/\/|\/\*|\* |<\/?[a-zA-Z])/;
const CODE_ASSIGNMENT_RE = /^\s*[\w.]+\s*=\s*\S/;

// プロンプト記号に一致し、かつその後ろに（出力ではなく）コマンド文字列があるかどうか
function isPromptLineWithContent(line: string): boolean {
  const match = PROMPT_RE.exec(line);
  return match !== null && match[0].length < line.length;
}

function looksLikeCode(line: string): boolean {
  const stripped = line.replace(LEADING_LINE_NUMBER_RE, "");
  return (
    CODE_TRAILING_RE.test(stripped) ||
    CODE_LEADING_CLOSE_RE.test(stripped) ||
    CODE_KEYWORD_RE.test(stripped) ||
    CODE_CONTROL_RE.test(stripped) ||
    CODE_OPERATOR_RE.test(stripped) ||
    CODE_CALL_RE.test(stripped) ||
    CODE_COMMENT_OR_TAG_RE.test(stripped) ||
    CODE_ASSIGNMENT_RE.test(stripped)
  );
}

// 生テキストが文章・コード・ターミナルのどれかを判定する
// 判定の優先順はterminal → code → prose
export function classifyText(rawText: string): TextType {
  const lines = rawText.split("\n").filter((line) => line.trim() !== "");
  const n = lines.length;
  if (n === 0) return "prose";

  const promptCount = lines.filter(isPromptLineWithContent).length;
  if (promptCount >= Math.ceil(n / 2)) return "terminal";

  const codeCount = lines.filter(looksLikeCode).length;
  if (codeCount / n >= 0.4) return "code";

  return "prose";
}
