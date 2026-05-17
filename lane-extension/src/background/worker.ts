chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'JOB_DETECTED') {
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  }
  if (message.type === 'JOB_APPLIED') {
    // Green check badge when application is auto-tracked
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  }
});

chrome.tabs.onActivated.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '' });
  }
});
