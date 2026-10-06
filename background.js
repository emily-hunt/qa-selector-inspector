chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "TOGGLE") return;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  });
});
