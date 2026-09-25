import {
  classifyText,
  formatText,
  MIN_SELECTION_SIZE,
  showCopyToast,
  startSelectionOverlay,
} from "@shotext/core";
import type { ExtensionMessage, OcrOutput, SelectionRect, TextType } from "@shotext/core";

declare global {
  interface Window {
    __shotextInjected?: boolean;
  }
}

// ショートカットを押すたびにexecuteScriptが同じファイルを実行するため、
// リスナーの登録が重複しないようグローバルのフラグで防ぐ
if (!window.__shotextInjected) {
  window.__shotextInjected = true;

  // トースト表示位置を決めるため、直近の選択範囲を覚えておく
  let lastRect: SelectionRect | null = null;
  // 直近のOCR結果を保持する（Dが編集パネルで使う）
  let lastResult: { output: OcrOutput; type: TextType; rect: SelectionRect } | null = null;

  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type === "START_SELECTION") {
      handleSelection();
    }
    if (message.type === "OCR_RESULT") {
      handleOcrResult(message.output);
    }
    if (message.type === "OCR_ERROR") {
      if (lastRect) {
        showCopyToast(lastRect, "Couldn't read text");
      }
    }
  });

  async function handleSelection() {
    const rect = await startSelectionOverlay();
    if (rect === null) {
      return;
    }

    if (rect.width < MIN_SELECTION_SIZE || rect.height < MIN_SELECTION_SIZE) {
      showCopyToast(rect, "Selection too small");
      return;
    }

    lastRect = rect;

    const message: ExtensionMessage = {
      type: "SELECTION_DONE",
      rect,
      devicePixelRatio: window.devicePixelRatio,
    };
    chrome.runtime.sendMessage(message);
  }

  async function handleOcrResult(output: OcrOutput) {
    if (!lastRect) {
      return;
    }
    const rect = lastRect;
    const type = classifyText(output.rawText);
    const text = formatText(output, type);
    lastResult = { output, type, rect };

    if (text.trim() === "") {
      // クリップボードは上書きしない
      showCopyToast(rect, "No text found");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showCopyToast(rect, "Copied!");
    } catch {
      showCopyToast(rect, "Copy failed");
    }
  }
}
