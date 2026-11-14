/**
 * VidSavor Extension - Background Service Worker (Manifest V3)
 * Handles context menus, tab monitoring, and download redirects
 */

const VID_SAVOR_BASE = "https://vidsavor.vercel.app";

// 1. Create Context Menus upon extension install/update
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "vidsavor-download-target",
        title: "Download Video with VidSavor",
        contexts: ["video", "link", "page", "image"]
    });

    chrome.contextMenus.create({
        id: "vidsavor-download-audio",
        title: "Extract MP3 Audio with VidSavor",
        contexts: ["video", "link", "page"]
    });
});

// 2. Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    let targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;

    if (!targetUrl) return;

    // Filter out internal browser pages
    if (targetUrl.startsWith("chrome://") || targetUrl.startsWith("edge://") || targetUrl.startsWith("about:")) {
        return;
    }

    const isAudio = info.menuItemId === "vidsavor-download-audio";
    const destination = isAudio 
        ? `${VID_SAVOR_BASE}/audio?url=${encodeURIComponent(targetUrl)}`
        : `${VID_SAVOR_BASE}/?url=${encodeURIComponent(targetUrl)}`;

    chrome.tabs.create({ url: destination });
});

// 3. Message routing between content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "OPEN_VIDSAVOR") {
        const dest = `${VID_SAVOR_BASE}/?url=${encodeURIComponent(message.url)}`;
        chrome.tabs.create({ url: dest });
        sendResponse({ status: "ok" });
    } else if (message.action === "GET_ACTIVE_TAB") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ tab: tabs[0] || null });
        });
        return true; // Keep sendResponse open for async
    }
});
