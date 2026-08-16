// Manifest V3の拡張機能は、「拡張機能全体の司令塔」となる、1つのbackground（service worker）を必ず1つ持つ設計
// manifest.jsonで、"background": { "service_worker": "src/background.ts","type": "module"} と指定
import type { ExtensionMessage, SelectionRect } from "@shotext/core";

// どのタブがOCRを依頼したかを記録
let activeTabId: number | null = null;

chrome.commands.onCommand.addListener((command) => {
  // manifest.jsonで登録済み
  if (command === "take-screenshot") {
    startSelection();
  }
});

async function startSelection() {
  // 条件に合うタブを探して、配列（複数の可能性があるので）で返す関数 / 今回は必ず一つ
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    return;
  }
  activeTabId = tab.id;

  const message: ExtensionMessage = { type: "START_SELECTION" };
  // 送信先（tab.id）を指定 / 受信側（content.ts）はどのタブかを気にする必要はない
  chrome.tabs.sendMessage(tab.id, message);
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "OCR_SELECTION_DONE") {
    handleSelectionDone(message.rect, message.devicePixelRatio);
  }
  if (message.type === "OCR_RESULT") {
    handleOcrResult(message.text);
  }
});

async function handleSelectionDone(rect: SelectionRect, devicePixelRatio: number) {
  // スクショが完了した後、画面全体を撮る前に、タブが切り替わっていないか再度確認
  // 今アクティブなタブをもう一度取得
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTab.id !== activeTabId) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/warning128.png"),
      title: "スクショOCR",
      message: "タブが切り替わったため中断しました。もう一度お試しください。",
    });
    return;
  }

  // 画面全体を撮影
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
  await ensureOffscreenDocument();

  const message: ExtensionMessage = {
    type: "RUN_OCR",
    dataUrl,
    rect,
    devicePixelRatio,
  };
  chrome.runtime.sendMessage(message);
}

async function ensureOffscreenDocument() {
  const hasDocument = await chrome.offscreen.hasDocument();
  if (hasDocument) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: "src/offscreen.html",
    reasons: ["WORKERS"],
    justification: "Tesseract.jsのWeb WorkerをOCR実行のために動かす",
  });
}

function handleOcrResult(text: string) {
  if (!activeTabId) {
    return;
  }
  const message: ExtensionMessage = { type: "COPY_TO_CLIPBOARD", text };
  chrome.tabs.sendMessage(activeTabId, message);
}
