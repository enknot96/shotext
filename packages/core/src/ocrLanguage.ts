// ブラウザのUI言語から、Tesseractに渡す認識言語を決める
// 日本語環境のユーザーは和文と英文の両方を読むが、それ以外は英語だけで十分。
// 英語だけにすれば、日本語の学習データ（約2MB）を読み込まずに済む
export function langsForUiLanguage(uiLanguage: string): string {
  return uiLanguage.toLowerCase().startsWith("ja") ? "jpn+eng" : "eng";
}
