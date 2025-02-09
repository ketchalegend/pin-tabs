# Tab Pin Manager Chrome Extension

A powerful Chrome extension for managing pinned tabs with advanced features for productivity and organization.

## Features

### Core Functionality
- 📌 Pin/unpin tabs with one click
- 🔄 Automatic tab restoration on browser startup
- 🎯 Quick pin current tab (Keyboard shortcut: Ctrl+Shift+P / Cmd+Shift+P)
- 📋 Clipboard support for quick URL pasting

### Batch Operations
- 📍 Pin all visible tabs at once
- 🗑️ Unpin all tabs
- 💾 Bulk import/export of pinned tabs

### Smart Features
- 🔍 Quick search through pinned tabs
- 📊 Usage statistics and insights
- ⚡ Instant tab switching
- 🔄 Auto-sync across browser sessions

### User Experience
- 🎨 Clean, modern interface
- 📱 Responsive design for all window sizes
- ⌨️ Keyboard shortcuts support
- 🔔 Visual feedback for actions

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Usage

### Basic Operations
- Click the extension icon to open the management page
- Enter a URL and click "Add & Pin Tab" to pin a new tab
- Use the search bar to quickly find pinned tabs
- Click "Open" to switch to a pinned tab
- Click "Delete" to unpin and remove a tab

### Keyboard Shortcuts
- `Ctrl+Shift+P` (Windows) / `Cmd+Shift+P` (Mac): Quick pin current tab
- `Enter` in URL input: Add and pin tab

### Backup & Restore
- Click "Export Tabs" to save your pinned tabs configuration
- Click "Import Tabs" to restore from a backup file

## Development

### Project Structure

├── manifest.json # Extension configuration ├── options.html # Main interface ├── options.js # Core functionality ├── background.js # Background processes ├── styles.css # Styling └── icons/ # Extension icons


### Technical Features
- Chrome Storage API for persistence
- Tab management API integration
- Event handling for browser actions
- Responsive design with CSS

## Updates

### Version 1.0
- Initial release with core functionality

### Version 1.1
- Added keyboard shortcuts
- Improved tab restoration
- Added statistics tracking
- Enhanced UI/UX

## Upcoming Features
- [ ] Dark mode support
- [ ] Custom tab groups
- [ ] Drag-and-drop reordering
- [ ] Cloud sync support
- [ ] Custom icons for pins

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details