// ブラウザのUI言語から、Tesseractに渡す認識言語を決める
// TODO(v1.1-B): 日本語環境以外では英語だけにする。現時点では従来どおり日英の両方
export function langsForUiLanguage(_uiLanguage: string): string {
  return "jpn+eng";
}
