// Manifest V3の拡張機能は、「拡張機能全体の司令塔」となる、1つのbackground（service worker）を必ず1つ持つ設計
// manifest.jsonで、"background": { "service_worker": "src/background.ts","type": "module"} と指定
import type { ExtensionMessage, SelectionRect } from "@shotext/core";
// IIFE形式でビルドされたcontentスクリプトのファイル名を取得する（動的importを使わないためweb_accessible_resourcesが不要）
import contentScript from "./content.ts?script&iife";

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
  const tabId = tab.id;

  try {
    // 静的なcontent_scriptsをやめたため、ショートカットが押されるたびにactiveTabへ注入する
    await chrome.scripting.executeScript({ target: { tabId }, files: [contentScript] });
  } catch {
    // chrome://ページやWebストアなど、注入できないページ
    notify("Can't capture this page");
    return;
  }

  const message: ExtensionMessage = { type: "START_SELECTION" };
  chrome.tabs.sendMessage(tabId, message);
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  if (message.type === "SELECTION_DONE") {
    // どのタブ・ウィンドウがOCRを依頼したかは、グローバル変数ではなく送信元の情報から取る
    // service workerは停止されることがあり、グローバル変数の値が消えるため
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (tabId === undefined || windowId === undefined) {
      return;
    }
    handleSelectionDone(tabId, windowId, message.rect, message.devicePixelRatio);
  }
  // offscreenからの結果は、依頼元のタブへそのまま転送する
  if (message.type === "OCR_RESULT" || message.type === "OCR_ERROR") {
    // タブがすでに閉じられていた場合はsendMessageが例外を出すが、通知先が無いだけなので無視する
    chrome.tabs.sendMessage(message.tabId, message).catch(() => {});
  }
});

async function handleSelectionDone(
  tabId: number,
  windowId: number,
  rect: SelectionRect,
  devicePixelRatio: number,
) {
  // スクショが完了した後、画面全体を撮る前に、タブが切り替わっていないか再度確認
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTab.id !== tabId) {
    notify("Tab changed. Please try again.");
    return;
  }

  let dataUrl: string;
  try {
    // 画面全体を撮影
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  } catch {
    notify("Can't capture this page");
    return;
  }

  await ensureOffscreenDocument();

  const message: ExtensionMessage = {
    type: "RUN_OCR",
    tabId,
    dataUrl,
    rect,
    devicePixelRatio,
    // offscreenではchrome.i18nが使えないため、UIの言語はここで取得して渡す
    uiLanguage: chrome.i18n.getUILanguage(),
  };
  chrome.runtime.sendMessage(message);
}

// 通知のタイトルは拡張機能名ではなく短い "ShoText" にする（通知欄で読みやすくするため）
function notify(message: string) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/warning128.png"),
    title: "ShoText",
    message,
  });
}

// ショートカットを素早く2回押すとcreateDocumentが2回呼ばれて例外になるため、
// 作成中のPromiseを覚えておき、作成中なら同じPromiseを待つようにする
let creatingOffscreenDocument: Promise<void> | null = null;

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: "src/offscreen.html",
        reasons: ["WORKERS"],
        justification: "Tesseract.jsのWeb WorkerをOCR実行のために動かす",
      })
      .finally(() => {
        creatingOffscreenDocument = null;
      });
  }
  await creatingOffscreenDocument;
}
