chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'JOB_DETECTED' && sender.tab?.id) {
    chrome.action.setBadgeText({ text: '●', tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId: sender.tab.id });
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
