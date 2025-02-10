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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.hasOwnProperty('pinned')) {
        handlePinStatusChange(tab);
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // We'll check if this was a pinned tab that was removed
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                // Tab doesn't exist anymore, we need to check our stored tabs
                const removedTab = tabs.find(t => t.id === tabId);
                if (removedTab) {
                    removeFromStorage(removedTab.url);
                }
            }
        });
    });
});

function handlePinStatusChange(tab) {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        const tabIndex = tabs.findIndex(t => t.url === tab.url);

        if (!tab.pinned && tabIndex !== -1) {
            // Tab was unpinned, remove it from storage
            const newTabs = tabs.filter(t => t.url !== tab.url);
            chrome.storage.local.set({ pinnedTabs: newTabs }, () => {
                // Notify options page to update
                chrome.runtime.sendMessage({ 
                    action: 'tabsUpdated',
                    removed: tab.url 
                });
            });
        } else if (tab.pinned && tabIndex === -1) {
            // Tab was pinned, add it to storage if not already there
            addToStorage(tab);
        }
    });
}

function handleTabError(error) {
    console.error('Tab operation error:', error);
    if (error.message.includes('No tab with id')) {
        return;
    }
}

function removeFromStorage(url) {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        const newTabs = tabs.filter(tab => tab.url !== url);
        chrome.storage.local.set({ pinnedTabs: newTabs }, () => {
            // Try to unpin any existing tabs with this URL
            chrome.tabs.query({ url: url }, (existingTabs) => {
                existingTabs.forEach(tab => {
                    chrome.tabs.update(tab.id, { pinned: false })
                        .catch(handleTabError);
                });
            });
            // Notify options page to update
            chrome.runtime.sendMessage({ 
                action: 'tabsUpdated',
                removed: url 
            });
        });
    });
}

function addToStorage(tab) {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        if (!tabs.some(t => t.url === tab.url)) {
            tabs.push({
                url: tab.url,
                addedAt: new Date().toISOString(),
                tags: [],
                timeSpent: 0,
                accessCount: 0,
                lastAccessed: null
            });
            chrome.storage.local.set({ pinnedTabs: tabs }, () => {
                // Notify options page to update if open
                chrome.runtime.sendMessage({ action: 'tabsUpdated' });
            });
        }
    });
}


// In background.js, update the restorePinnedTabs function:
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
                        index: index // This is fine in create
                    });
                } else if (!existingTabs.some(t => t.pinned)) {
                    chrome.tabs.update(existingTabs[0].id, { 
                        pinned: true // Remove index from here
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

let activeTabStartTime = null;
let activeTabId = null;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    if (activeTabStartTime && activeTabId) {
        updateTabTime(activeTabId);
    }
    
    if (tab.pinned) {
        activeTabStartTime = Date.now();
        activeTabId = tab.id;
        updateTabAccess(tab.url);
    }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        if (activeTabStartTime && activeTabId) {
            updateTabTime(activeTabId);
            activeTabStartTime = null;
            activeTabId = null;
        }
    }
});

async function updateTabTime(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        const timeSpent = Date.now() - activeTabStartTime;
        
        // Ignore unreasonable time differences (e.g., more than 12 hours)
        if (timeSpent > 43200000) { // 12 hours in milliseconds
            activeTabStartTime = null;
            activeTabId = null;
            return;
        }

        chrome.storage.local.get('pinnedTabs', (data) => {
            const tabs = data.pinnedTabs || [];
            const tabIndex = tabs.findIndex(t => t.url === tab.url);
            
            if (tabIndex !== -1) {
                // Reset counter if it gets too large
                const currentTime = tabs[tabIndex].timeSpent || 0;
                if (currentTime > 2147483647) { // Max reasonable value
                    tabs[tabIndex].timeSpent = timeSpent;
                } else {
                    tabs[tabIndex].timeSpent = currentTime + timeSpent;
                }
                
                tabs[tabIndex].lastAccessed = new Date().toISOString();
                chrome.storage.local.set({ pinnedTabs: tabs });
            }
        });
    } catch (error) {
        activeTabStartTime = null;
        activeTabId = null;
        console.log('Tab no longer exists:', error);
    }
}

function updateTabAccess(url) {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        const tabIndex = tabs.findIndex(t => t.url === url);
        
        if (tabIndex !== -1) {
            tabs[tabIndex].accessCount = (tabs[tabIndex].accessCount || 0) + 1;
            chrome.storage.local.set({ pinnedTabs: tabs });
        }
    });
}

// Listen for crashes
chrome.runtime.onStartup.addListener(recoverLastSession);