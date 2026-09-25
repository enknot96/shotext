import type { TextType } from "./types";

// 生テキストが文章・コード・ターミナルのどれかを判定する
// TODO(v1.1-A): 判定ルールを実装する。現時点では従来どおり、常に文章として扱う
export function classifyText(_rawText: string): TextType {
  return "prose";
}
