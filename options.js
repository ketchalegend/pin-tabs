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

        li.innerHTML = `
            <div class="tab-content">
                <div class="tab-url">${tab.url}</div>
                <div class="tab-meta">Added: ${new Date(tab.addedAt).toLocaleDateString()}</div>
            </div>
            <div class="tab-actions">
                <button class="btn btn-primary open-btn">Open</button>
                <button class="btn btn-danger delete-btn">Delete</button>
            </div>
        `;

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
        let mostRecentPin = '-';
        
        if (tabs.length > 0) {
            try {
                const url = new URL(tabs[tabs.length - 1].url);
                mostRecentPin = url.hostname.replace('www.', '');
            } catch (e) {
                mostRecentPin = tabs[tabs.length - 1].url;
            }
        }

        const statsHtml = `
            <h2>Overview</h2>
            <div class="stats-container">
                <div class="stat-item">
                    <span class="stat-label">Total Pinned Tabs</span>
                    <span class="stat-value">${tabs.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Most Recent Pin</span>
                    <span class="stat-value">${mostRecentPin}</span>
                </div>
            </div>
        `;
        
        document.querySelector('.stats-section').innerHTML = statsHtml;
    });
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
    const newOrder = [];
    
    items.forEach(item => {
        const url = item.querySelector('.tab-url').textContent;
        const addedAt = new Date(item.querySelector('.tab-meta').textContent.replace('Added: ', '')).toISOString();
        newOrder.push({ url, addedAt });
    });

    chrome.storage.local.set({ pinnedTabs: newOrder }, () => {
        // Refresh pinned tabs in their new order
        chrome.tabs.query({ pinned: true }, (tabs) => {
            tabs.forEach((tab, index) => {
                chrome.tabs.move(tab.id, { index });
            });
        });
        updateStats(); // Update stats after reordering
    });
}

    function addPinnedTab(url) {
        chrome.storage.local.get('pinnedTabs', (data) => {
            const tabs = data.pinnedTabs || [];
            
            if (tabs.some(tab => tab.url === url)) {
                alert('This URL is already pinned!');
                return;
            }

            const newTab = {
                url,
                addedAt: new Date().toISOString()
            };

            tabs.push(newTab);
            
            chrome.storage.local.set({ pinnedTabs: tabs }, () => {
                chrome.tabs.create({ url: url, pinned: true }, () => {
                    loadPinnedTabs();
                    window.close();
                });
            });
        });
    }

    function removeTab(url) {
        chrome.storage.local.get('pinnedTabs', (data) => {
            const tabs = data.pinnedTabs || [];
            const newTabs = tabs.filter(tab => tab.url !== url);
            chrome.storage.local.set({ pinnedTabs: newTabs });

            chrome.tabs.query({ url }, tabs => {
                tabs.forEach(tab => {
                    chrome.tabs.update(tab.id, { pinned: false });
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

});

