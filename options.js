document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const tabUrl = document.getElementById('tabUrl');
    const addButton = document.getElementById('addButton');
    const pinnedList = document.getElementById('pinnedList');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const searchTabs = document.getElementById('searchTabs');
    const pasteUrl = document.getElementById('pasteUrl');
    const pinCurrentTab = document.getElementById('pinCurrentTab');
    const pinAllTabs = document.getElementById('pinAllTabs');
    const unpinAllTabs = document.getElementById('unpinAllTabs');
    const themeToggle = document.getElementById('themeToggle');

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
    }

    // Theme toggle handler
    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });


chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'tabsUpdated') {
        if (message.removed) {
            // Remove the specific tab element if it exists
            const tabElement = Array.from(pinnedList.children)
                .find(el => el.querySelector('.tab-url').textContent === message.removed);
            if (tabElement) {
                tabElement.remove();
            }
        }
        loadPinnedTabs();
        updateStats();
    }
});


    // Load existing pins
    loadPinnedTabs();
    enableDragAndDrop(); // Add this line to enable drag and drop
    updateStats();

    // Paste URL button
    pasteUrl.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            tabUrl.value = text;
        } catch (err) {
            alert('Unable to read from clipboard');
        }
    });

     function onStorageChange() {
        updateStats();
    }

        chrome.storage.onChanged.addListener(onStorageChange);


     pinnedList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(pinnedList, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement) {
            pinnedList.insertBefore(draggable, afterElement);
        } else {
            pinnedList.appendChild(draggable);
        }
    });

    chrome.commands.onCommand.addListener((command) => {
    if (command === "quick-pin") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                addPinnedTab(tabs[0].url);
            }
        });
    }
    });

    // Quick Actions
    pinCurrentTab.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                addPinnedTab(tabs[0].url);
            }
        });
    });

    pinAllTabs.addEventListener('click', () => {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
            const newPins = [];
            tabs.forEach(tab => {
                chrome.tabs.update(tab.id, { pinned: true });
                // Add to saved pins if not already there
                if (!isPinned(tab.url)) {
                    newPins.push({
                        url: tab.url,
                        addedAt: new Date().toISOString()
                    });
                }
            });
            
            // Update storage and refresh list
            chrome.storage.local.get('pinnedTabs', (data) => {
                const currentPins = data.pinnedTabs || [];
                const updatedPins = [...currentPins, ...newPins];
                chrome.storage.local.set({ pinnedTabs: updatedPins }, () => {
                    loadPinnedTabs(); // Refresh the list
                });
            });
        });
    });

    unpinAllTabs.addEventListener('click', () => {
        chrome.tabs.query({ pinned: true }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.update(tab.id, { pinned: false });
            });
            // Clear storage and refresh list
            chrome.storage.local.set({ pinnedTabs: [] }, () => {
                loadPinnedTabs(); // Refresh the list
            });
        });
    });

    function isPinned(url) {
        const pinnedItems = pinnedList.getElementsByClassName('tab-item');
        return Array.from(pinnedItems).some(item => 
            item.querySelector('.tab-url').textContent === url
        );
    }

    // Search functionality
    searchTabs.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const items = pinnedList.getElementsByTagName('li');
        
        Array.from(items).forEach(item => {
            const url = item.querySelector('.tab-url').textContent.toLowerCase();
            item.style.display = url.includes(searchTerm) ? '' : 'none';
        });
    });

    // Add new pin
    addButton.addEventListener('click', () => {
        const url = tabUrl.value.trim();
        if (url && isValidURL(url)) {
            addPinnedTab(url);
            tabUrl.value = '';
        } else {
            alert('Please enter a valid URL');
        }
    });

    // Enter key to add
    tabUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addButton.click();
        }
    });

    // Export/Import functionality
    exportBtn.addEventListener('click', () => {
        chrome.storage.local.get('pinnedTabs', (data) => {
            const tabs = data.pinnedTabs || [];
            const blob = new Blob([JSON.stringify(tabs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pinned-tabs-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    });

    importBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = event => {
                try {
                    const tabs = JSON.parse(event.target.result);
                    chrome.storage.local.set({ pinnedTabs: tabs }, () => {
                        loadPinnedTabs();
                        tabs.forEach(tab => {
                            chrome.tabs.create({ url: tab.url, pinned: true });
                        });
                        alert('Tabs imported successfully!');
                    });
                } catch (error) {
                    alert('Error importing tabs. Please check the file format.');
                }
            };
            
            reader.readAsText(file);
        };

        input.click();
    });

    function createTabElement(tab) {
        const li = document.createElement('li');
        li.className = 'tab-item';
        li.draggable = true; // Enable dragging

        const timeSpent = formatTimeSpent(tab.timeSpent || 0);
        const tags = tab.tags || [];

        li.innerHTML = `
        <div class="tab-content">
            <div class="tab-url">
                <span class="material-icons-round">link</span>
                ${tab.url}
            </div>
            <div class="tab-tags">
                ${tags.map(tag => `
                    <span class="tag">
                        <span class="material-icons-round">label</span>
                        ${tag}
                        <button class="remove-tag" data-tag="${tag}">
                            <span class="material-icons-round">close</span>
                        </button>
                    </span>
                `).join('')}
                <button class="add-tag-btn">
                    <span class="material-icons-round">add</span>
                    Add Tag
                </button>
            </div>
            <div class="tab-meta">
                <span>
                    <span class="material-icons-round">calendar_today</span>
                    Added: ${new Date(tab.addedAt).toLocaleDateString()}
                </span>
                <span class="time-spent">
                    <span class="material-icons-round">schedule</span>
                    Time: ${timeSpent}
                </span>
                <span class="access-count">
                    <span class="material-icons-round">visibility</span>
                    Views: ${tab.accessCount || 0}
                </span>
            </div>
        </div>
        <div class="tab-actions">
            <button class="btn btn-primary open-btn">
                <span class="material-icons-round">open_in_new</span>
                Open
            </button>
            <button class="btn btn-danger delete-btn">
                <span class="material-icons-round">delete</span>
                Delete
            </button>
        </div>
    `;

            const addTagBtn = li.querySelector('.add-tag-btn');
            addTagBtn.addEventListener('click', () => showTagDialog(tab));

            li.querySelectorAll('.remove-tag').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeTag(tab, btn.dataset.tag);
                });
            });

           li.addEventListener('dragstart', (e) => {
            e.target.classList.add('dragging');
            });

            li.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                // Save the new order
                saveNewOrder();
            });

        // Open existing tab or create new one
        li.querySelector('.open-btn').addEventListener('click', () => {
            chrome.tabs.query({}, (tabs) => {
                const existingTab = tabs.find(t => t.url === tab.url);
                if (existingTab) {
                    chrome.tabs.update(existingTab.id, { active: true, pinned: true });
                    chrome.windows.update(existingTab.windowId, { focused: true });
                } else {
                    chrome.tabs.create({ url: tab.url, pinned: true });
                }
            });
        });

        li.querySelector('.delete-btn').addEventListener('click', () => {
            removeTab(tab.url);
            li.remove();
        });

        return li;
    }

    function saveNewOrder() {
    const items = document.querySelectorAll('.tab-item');
    const newOrder = [];
    
    items.forEach(item => {
        const url = item.querySelector('.tab-url').textContent;
        const addedAt = new Date(item.querySelector('.tab-meta').textContent.replace('Added: ', '')).toISOString();
        newOrder.push({ url, addedAt });
    });

    chrome.storage.local.set({ pinnedTabs: newOrder }, () => {
        // Optionally refresh all pinned tabs in their new order
        chrome.tabs.query({ pinned: true }, (tabs) => {
            tabs.forEach((tab, index) => {
                chrome.tabs.move(tab.id, { index });
            });
        });
    });
    }

    function removeTag(tab, tagToRemove) {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        const tabIndex = tabs.findIndex(t => t.url === tab.url);
        
        if (tabIndex !== -1 && tabs[tabIndex].tags) {
            tabs[tabIndex].tags = tabs[tabIndex].tags.filter(tag => tag !== tagToRemove);
            
            chrome.storage.local.set({ pinnedTabs: tabs }, () => {
                loadPinnedTabs(); // Refresh the list
                showToast(`Tag removed`, 'success');
            });
        }
    });
}

function showTagDialog(tab) {
    const dialog = document.createElement('div');
    dialog.className = 'tag-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>Add Tags</h3>
            <div class="suggested-tags">
                ${getSuggestedTags().map(tag => `
                    <span class="tag suggested" data-tag="${tag}">${tag}</span>
                `).join('')}
            </div>
            <input type="text" class="tag-input" placeholder="Enter tag name">
            <div class="dialog-actions">
                <button class="btn btn-primary add-tag">Add</button>
                <button class="btn btn-secondary cancel">Cancel</button>
            </div>
        </div>
    `;

    // Add event listeners
    const tagInput = dialog.querySelector('.tag-input');
    const addButton = dialog.querySelector('.add-tag');
    const cancelButton = dialog.querySelector('.cancel');
    const suggestedTags = dialog.querySelectorAll('.suggested');

    // Handle suggested tag clicks
    suggestedTags.forEach(tag => {
        tag.addEventListener('click', () => {
            tagInput.value = tag.dataset.tag;
        });
    });

    // Handle add button click
    addButton.addEventListener('click', () => {
        const newTag = tagInput.value.trim().toLowerCase();
        if (newTag) {
            addTagToTab(tab, newTag);
            document.body.removeChild(dialog);
        }
    });

    // Handle cancel button click
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    // Handle enter key
    tagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addButton.click();
        }
    });

    // Close dialog when clicking outside
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            document.body.removeChild(dialog);
        }
    });

    document.body.appendChild(dialog);
}

function addTagToTab(tab, tag) {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        const tabIndex = tabs.findIndex(t => t.url === tab.url);
        
        if (tabIndex !== -1) {
            // Initialize tags array if it doesn't exist
            if (!tabs[tabIndex].tags) {
                tabs[tabIndex].tags = [];
            }
            
            // Add tag if it doesn't already exist
            if (!tabs[tabIndex].tags.includes(tag)) {
                tabs[tabIndex].tags.push(tag);
                
                chrome.storage.local.set({ pinnedTabs: tabs }, () => {
                    loadPinnedTabs(); // Refresh the list
                    showToast(`Tag "${tag}" added successfully!`, 'success');
                });
            } else {
                showToast('Tag already exists!', 'warning');
            }
        }
    });
}

    function getSuggestedTags() {
        return ['work', 'personal', 'reading', 'social', 'shopping'];
    }

    function loadPinnedTabs() {
        chrome.storage.local.get('pinnedTabs', (data) => {
            pinnedList.innerHTML = '';
            const tabs = data.pinnedTabs || [];
            tabs.forEach(tab => {
                pinnedList.appendChild(createTabElement(tab));
            });
        });
    }

function updateStats() {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        
        const stats = {
            totalPins: tabs.length,
            totalTime: tabs.reduce((acc, tab) => acc + (tab.timeSpent || 0), 0),
            mostUsed: [...tabs].sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))[0],
            mostTime: [...tabs].sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))[0],
            byTags: getTagStats(tabs)
        };

        const statsSection = document.querySelector('.stats-section');
        statsSection.innerHTML = `
            <div class="stats-header">
                <h2>Dashboard</h2>
                <button id="resetStatsBtn" class="btn btn-secondary">Reset Stats</button>
            </div>
            <div class="stats-container">
                <div class="stat-item">
                    <span class="stat-label">Total Pinned Tabs</span>
                    <span class="stat-value">${stats.totalPins}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Time Spent</span>
                    <span class="stat-value">${formatTimeSpent(stats.totalTime)}</span>
                </div>
                ${stats.mostUsed ? `
                <div class="stat-item">
                    <span class="stat-label">Most Visited</span>
                    <span class="stat-value">${new URL(stats.mostUsed.url).hostname}</span>
                    <span class="stat-sub">${stats.mostUsed.accessCount || 0} visits</span>
                </div>
                ` : ''}
            </div>
            <div class="tags-chart">
                ${generateTagsChart(stats.byTags)}
            </div>
        `;

        // Add event listener to reset button
        document.getElementById('resetStatsBtn').addEventListener('click', resetTimeStats);
    });
}

function getTagStats(tabs) {
    const tagStats = {};
    tabs.forEach(tab => {
        (tab.tags || []).forEach(tag => {
            tagStats[tag] = (tagStats[tag] || 0) + 1;
        });
    });
    return tagStats;
}

function generateTagsChart(tagStats) {
    // You could use a library like Chart.js here
    // For now, we'll create a simple bar chart
    return `
        <div class="tags-distribution">
            ${Object.entries(tagStats).map(([tag, count]) => `
                <div class="tag-bar">
                    <span class="tag-name">${tag}</span>
                    <div class="bar" style="width: ${(count * 100 / Object.keys(tagStats).length)}%">
                        ${count}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function resetTimeStats() {
    chrome.storage.local.get('pinnedTabs', (data) => {
        const tabs = data.pinnedTabs || [];
        tabs.forEach(tab => {
            tab.timeSpent = 0;
            tab.accessCount = 0;
        });
        chrome.storage.local.set({ pinnedTabs: tabs }, () => {
            updateStats();
            showToast('Time statistics reset', 'info');
        });
    });
}

function formatTimeSpent(ms) {
    // Add sanity check for unreasonable values
    if (ms > 2147483647 || ms < 0) { // Max reasonable value (about 24.8 days)
        return '0s';
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

    // Add to options.js
function enableDragAndDrop() {
    const tabsList = document.getElementById('pinnedList');

    tabsList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('tab-item')) {
            e.target.classList.add('dragging');
        }
    });

    tabsList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('tab-item')) {
            e.target.classList.remove('dragging');
            saveNewOrder();
        }
    });

    tabsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        if (!draggable) return;

        const afterElement = getDragAfterElement(tabsList, e.clientY);
        if (afterElement) {
            tabsList.insertBefore(draggable, afterElement);
        } else {
            tabsList.appendChild(draggable);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.tab-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveNewOrder() {
    const items = document.querySelectorAll('.tab-item');
    
    chrome.storage.local.get('pinnedTabs', (data) => {
        const oldTabs = data.pinnedTabs || [];
        const newOrder = [];
        
        // Preserve all properties while reordering
        items.forEach(item => {
            const url = item.querySelector('.tab-url').textContent;
            const oldTab = oldTabs.find(tab => tab.url === url);
            if (oldTab) {
                newOrder.push(oldTab);
            }
        });

        chrome.storage.local.set({ pinnedTabs: newOrder }, () => {
            // Get all pinned tabs and reorder them
            chrome.tabs.query({ pinned: true }, (tabs) => {
                tabs.forEach((tab) => {
                    const newIndex = newOrder.findIndex(nt => nt.url === tab.url);
                    if (newIndex !== -1) {
                        chrome.tabs.move(tab.id, { index: newIndex });
                    }
                });
            });
            updateStats();
        });
    });
}

    function addPinnedTab(url) {
        chrome.storage.local.get('pinnedTabs', (data) => {
            const tabs = data.pinnedTabs || [];
            
            if (tabs.some(tab => tab.url === url)) {
                showToast('This URL is already pinned!', 'warning');
                return;
            }

            const newTab = {
                url,
                addedAt: new Date().toISOString(),
                tags: [],
                timeSpent: 0,
                accessCount: 0,
                lastAccessed: null
            };

            tabs.push(newTab);
            
            chrome.storage.local.set({ pinnedTabs: tabs }, () => {
                chrome.tabs.create({ url: url, pinned: true }, () => {
                    loadPinnedTabs();
                    showToast('Tab pinned successfully!', 'success');
                    window.close();
                });
            });
        });
    }

    function removeTab(url) {
        chrome.storage.local.get('pinnedTabs', (data) => {
            const tabs = data.pinnedTabs || [];
            const newTabs = tabs.filter(tab => tab.url !== url);
            chrome.storage.local.set({ pinnedTabs: newTabs }, () => {
                // Query for the exact URL match
                chrome.tabs.query({ url: url }, tabs => {
                    tabs.forEach(tab => {
                        if (tab.url === url) { // Additional exact URL check
                            chrome.tabs.update(tab.id, { pinned: false });
                        }
                    });
                });
            });
        });
    }

    function isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (err) {
            return false;
        }
    }

    function showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        // Add to container
        container.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                container.removeChild(toast);
                if (container.children.length === 0) {
                    document.body.removeChild(container);
                }
            }, 300);
        }, 3000);
    }

});

