// Open options page when clicking extension icon
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Handle browser startup
chrome.runtime.onStartup.addListener(() => {
  restorePinnedTabs();
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  restorePinnedTabs();
});


function restorePinnedTabs() {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        
        // Create pinned tabs in order (left to right)
        tabs.forEach((tab, index) => {
            chrome.tabs.query({ url: tab.url }, (existingTabs) => {
                if (existingTabs.length === 0) {
                    chrome.tabs.create({ 
                        url: tab.url, 
                        pinned: true,
                        index: index // This ensures order from left to right
                    });
                } else if (!existingTabs.some(t => t.pinned)) {
                    chrome.tabs.update(existingTabs[0].id, { 
                        pinned: true,
                        index: index
                    });
                }
            });
        });
    });
}

// Add to background.js
let sessionBackup = [];

// Save session periodically
setInterval(() => {
    chrome.tabs.query({}, (tabs) => {
        sessionBackup = tabs.map(tab => ({
            url: tab.url,
            pinned: tab.pinned,
            title: tab.title,
            timestamp: Date.now()
        }));
        chrome.storage.local.set({ 'sessionBackup': sessionBackup });
    });
}, 60000); // Every minute

// Add recovery function
function recoverLastSession() {
    chrome.storage.local.get('sessionBackup', (data) => {
        if (data.sessionBackup) {
            data.sessionBackup.forEach(tab => {
                chrome.tabs.create({
                    url: tab.url,
                    pinned: tab.pinned
                });
            });
        }
    });
}

// Listen for crashes
chrome.runtime.onStartup.addListener(recoverLastSession);