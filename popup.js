// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const addButton = document.getElementById("addButton");
  const tabUrlInput = document.getElementById("tabUrl");
  const pinnedList = document.getElementById("pinnedList");
  const clearAllButton = document.getElementById("clearAllButton");

  // Load saved pinned tabs from storage
  chrome.storage.local.get("pinnedTabs", (data) => {
    const pinnedTabs = data.pinnedTabs || [];
    pinnedTabs.forEach((tabData) => {
      addTabToList(tabData.url, tabData.windowId);
    });
  });

  // Add a new tab to the list
  addButton.addEventListener("click", () => {
    const url = tabUrlInput.value.trim();
    if (url && isValidURL(url)) {
      chrome.storage.local.get("pinnedTabs", (data) => {
        const pinnedTabs = data.pinnedTabs || [];
        if (!pinnedTabs.some((tab) => tab.url === url)) {
          const newTab = { url, windowId: null }; // Default windowId is null
          pinnedTabs.push(newTab);
          chrome.storage.local.set({ pinnedTabs }, () => {
            addTabToList(url, null);
            tabUrlInput.value = "";
          });
        } else {
          alert("This URL is already in the list.");
        }
      });
    } else {
      alert("Please enter a valid URL.");
    }
  });

  // Clear all pinned tabs
  clearAllButton.addEventListener("click", () => {
    chrome.storage.local.remove("pinnedTabs", () => {
      pinnedList.innerHTML = "";
    });
  });

  // Helper function to validate URLs
  function isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (err) {
      return false;
    }
  }

  // Helper function to add a tab to the list
  function addTabToList(url, windowId) {
    const li = document.createElement("li");
    li.draggable = true;
    li.classList.add("flex", "items-center", "justify-between", "bg-white", "p-2", "rounded-md", "shadow-sm");

    const span = document.createElement("span");
    span.textContent = url;
    span.classList.add("flex-1", "mr-2");

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.classList.add("px-2", "py-1", "bg-red-500", "text-white", "rounded", "hover:bg-red-600");
    removeButton.addEventListener("click", () => {
      removeTabFromList(url);
      li.remove();
    });

    const windowButton = document.createElement("button");
    windowButton.textContent = "Set Window";
    windowButton.classList.add("px-2", "py-1", "bg-green-500", "text-white", "rounded", "hover:bg-green-600");
    windowButton.addEventListener("click", () => {
      promptForWindowId(url);
    });

    li.appendChild(span);
    li.appendChild(removeButton);
    li.appendChild(windowButton);

    pinnedList.appendChild(li);

    // Enable drag-and-drop reordering
    li.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", url));
    li.addEventListener("dragover", (e) => e.preventDefault());
    li.addEventListener("drop", (e) => handleDrop(e, url));
  }

  // Handle drag-and-drop reordering
  function handleDrop(event, draggedUrl) {
    const dropUrl = event.target.closest("li")?.querySelector("span").textContent;
    if (dropUrl && dropUrl !== draggedUrl) {
      chrome.storage.local.get("pinnedTabs", (data) => {
        const pinnedTabs = data.pinnedTabs || [];
        const draggedIndex = pinnedTabs.findIndex((tab) => tab.url === draggedUrl);
        const dropIndex = pinnedTabs.findIndex((tab) => tab.url === dropUrl);

        if (draggedIndex !== -1 && dropIndex !== -1) {
          const [removed] = pinnedTabs.splice(draggedIndex, 1);
          pinnedTabs.splice(dropIndex, 0, removed);
          chrome.storage.local.set({ pinnedTabs }, () => {
            pinnedList.innerHTML = "";
            pinnedTabs.forEach((tab) => addTabToList(tab.url, tab.windowId));
          });
        }
      });
    }
  }

  // Prompt user to specify a window ID
  function promptForWindowId(url) {
    chrome.windows.getAll({ populate: true }, (windows) => {
      const windowOptions = windows.map((window) => `${window.id}: ${window.title}`).join("\n");
      const input = prompt("Select a window ID:\n" + windowOptions);
      if (input) {
        const windowId = parseInt(input, 10);
        if (!isNaN(windowId)) {
          chrome.storage.local.get("pinnedTabs", (data) => {
            const pinnedTabs = data.pinnedTabs || [];
            const index = pinnedTabs.findIndex((tab) => tab.url === url);
            if (index !== -1) {
              pinnedTabs[index].windowId = windowId;
              chrome.storage.local.set({ pinnedTabs });
            }
          });
        }
      }
    });
  }

  // Remove a tab from the list
  function removeTabFromList(url) {
    chrome.storage.local.get("pinnedTabs", (data) => {
      const pinnedTabs = data.pinnedTabs || [];
      const index = pinnedTabs.findIndex((tab) => tab.url === url);
      if (index !== -1) {
        pinnedTabs.splice(index, 1);
        chrome.storage.local.set({ pinnedTabs });
      }
    });
  }
});