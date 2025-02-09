// utils.js
const STORAGE_KEY = 'pinnedTabs';

// Smart URL handling
async function processUrl(url) {
    try {
        const urlObj = new URL(url);
        const response = await fetch(url, { method: 'HEAD' });
        return {
            url: urlObj.href,
            favicon: `https://favicon.ico/${urlObj.hostname}`,
            title: urlObj.hostname.replace('www.', '')
        };
    } catch (err) {
        throw new Error('Invalid URL');
    }
}

// Backup/Restore
async function exportData() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `pinned-tabs-backup-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function importData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await chrome.storage.local.set(data);
                resolve(data[STORAGE_KEY]);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
}

// Analytics
function analyzePinUsage(pins) {
    return {
        totalPins: pins.length,
        byCategory: pins.reduce((acc, pin) => {
            acc[pin.category] = (acc[pin.category] || 0) + 1;
            return acc;
        }, {}),
        mostUsed: pins.sort((a, b) => b.accessCount - a.accessCount)[0],
        recentlyAdded: pins.sort((a, b) => 
            new Date(b.addedAt) - new Date(a.addedAt)
        ).slice(0, 5)
    };
}

export { processUrl, exportData, importData, analyzePinUsage, STORAGE_KEY };