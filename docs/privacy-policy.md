# プライバシーポリシー / Privacy Policy

最終更新日 / Last updated: 2026-08-18

## 日本語

「ショッテキ！ - ShoText！」（以下「本拡張機能」）は、ユーザーが選択した画面範囲の文字を認識（OCR）し、クリップボードにコピーするChrome拡張機能です。

### 収集する情報

本拡張機能は、**いかなる個人情報・利用データも収集、保存、送信しません。**

- 選択した範囲の画像は、ブラウザ内で一時的に処理されるのみで、外部サーバーへ送信されることはありません
- OCR（文字認識）処理はすべて[Tesseract.js](https://github.com/naptha/tesseract.js)（WebAssembly）を使い、お使いのブラウザ内でローカルに実行されます
- 認識したテキストは、お使いのクリップボードにコピーされるだけで、どこにも保存・送信されません
- アクセス解析、広告、トラッキングの類は一切組み込んでいません

### 使用している権限とその目的

| 権限 | 目的 |
|---|---|
| `activeTab` | ショートカット操作時に、現在アクティブなタブの画面を撮影（範囲選択したテキストを認識するため） |
| `offscreen` | OCR処理（Tesseract.jsのWeb Worker）をバックグラウンドで実行するため |
| `notifications` | 選択操作が中断された場合など、状態をユーザーに知らせるため |
| `clipboardWrite` | 認識したテキストをクリップボードにコピーするため |

なお、範囲選択の機能（コンテンツスクリプト）はすべてのWebページ（`<all_urls>`）で動作します。これは、ユーザーがどのサイトを見ていても同じ操作でテキストを抜き出せるようにするためであり、閲覧内容の収集や送信は一切行いません。

### お問い合わせ

本ポリシーに関するご質問は、GitHubリポジトリのIssueにてお願いします。

---

## English

"ShoText！" (the "Extension") is a Chrome extension that recognizes (OCRs) text within a user-selected area of the screen and copies it to the clipboard.

### Information We Collect

This extension **does not collect, store, or transmit any personal information or usage data.**

- The image of the selected area is only processed temporarily inside your browser and is never sent to any external server
- OCR (text recognition) runs entirely on-device using [Tesseract.js](https://github.com/naptha/tesseract.js) (WebAssembly)
- Recognized text is only copied to your clipboard — it is never stored or transmitted anywhere
- No analytics, advertising, or tracking of any kind is included

### Permissions Used

| Permission | Purpose |
|---|---|
| `activeTab` | To capture the active tab's screen when triggered by the keyboard shortcut, so the selected area can be recognized |
| `offscreen` | To run OCR processing (Tesseract.js Web Worker) in the background |
| `notifications` | To inform the user when a selection is interrupted or another status update occurs |
| `clipboardWrite` | To copy the recognized text to the clipboard |

Note: the selection feature (content script) runs on all web pages (`<all_urls>`), so the same shortcut works consistently no matter what site you're on. This does not mean any browsing content is collected or transmitted — it is only used to draw the selection overlay.

### Contact

For questions about this policy, please open an issue on the GitHub repository.
