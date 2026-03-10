// content.js — Lightweight bridge
// Main logic is injected by background.js via scripting.executeScript
// This file just ensures the extension is recognized on the IRCTC page

console.log('[IRCTC AutoClicker] Content script loaded on:', window.location.href);

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ alive: true, url: window.location.href });
  }
  return true;
});
