chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed and ready.');
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error('Failed to set panel behavior:', error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    chrome.storage.local.set({ 
      selectedText: message.text,
      shouldAnalyze: !!message.shouldAnalyze // Store the flag indicating whether to analyze
    }, () => {
      console.log('Selected text saved:', message.text);
      console.log('Should analyze:', !!message.shouldAnalyze);
      chrome.runtime.sendMessage({ 
        action: 'updateSidePanel', 
        text: message.text,
        shouldAnalyze: !!message.shouldAnalyze
      });
    });
    chrome.windows.getCurrent({ populate: false }, (currentWindow) => {
      chrome.sidePanel.open({ windowId: currentWindow.id })
        .then(() => {
          console.log('Side panel opened successfully');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Failed to open side panel:', error);
          sendResponse({ success: false, error: error.message });
        });
    });
    // Indicate that the response will be sent asynchronously
    return true;
  }
});