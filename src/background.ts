/**
 * FlowState Background Service Worker
 */

// Listen for extension icon click - toggle sidebar
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    // Try to send message to toggle sidebar
    await chrome.tabs.sendMessage(tab.id, { action: "toggle-sidebar" });
  } catch {
    // Content script not loaded, inject it first
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["dist/content.js"],
    });

    // Wait a moment for initialization, then toggle
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id!, { action: "toggle-sidebar" });
      } catch (e) {
        console.error("[FlowState] Failed to toggle sidebar:", e);
      }
    }, 500);
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "get-api-key") {
    chrome.storage.local.get(["openrouter_api_key"]).then((result) => {
      sendResponse({ apiKey: result.openrouter_api_key || null });
    });
    return true;
  }

  if (message.action === "set-api-key") {
    chrome.storage.local
      .set({ openrouter_api_key: message.apiKey })
      .then(() => {
        sendResponse({ success: true });
      });
    return true;
  }

  return false;
});

console.log("[FlowState] Background service worker ready");

export {}; // Make it a module
