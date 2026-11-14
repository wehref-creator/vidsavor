/**
 * VidSavor Extension - Popup Controller
 */

const VID_SAVOR_BASE = "https://vidsavor.vercel.app";

document.addEventListener('DOMContentLoaded', async () => {
    const detectionCard = document.getElementById('detectionCard');
    const detectionPlatformIcon = document.getElementById('detectionPlatformIcon');
    const detectionPlatformLabel = document.getElementById('detectionPlatformLabel');
    const detectionUrl = document.getElementById('detectionUrl');
    const btnActiveDownload = document.getElementById('btnActiveDownload');
    const statusText = document.getElementById('statusText');

    const manualUrlInput = document.getElementById('manualUrlInput');
    const btnPaste = document.getElementById('btnPaste');
    const btnFetchManual = document.getElementById('btnFetchManual');

    let activeTabUrl = "";

    // 1. Detect Active Tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url) {
            detectionUrl.textContent = "No active page found";
            return;
        }

        activeTabUrl = tab.url;
        const urlObj = new URL(tab.url);
        const host = urlObj.hostname;

        let detected = false;
        let platformName = "";
        let platformIcon = "🎬";

        if (host.includes('instagram.com')) {
            detected = true;
            platformName = "Instagram Reel / Post";
            platformIcon = "📸";
        } else if (host.includes('tiktok.com')) {
            detected = true;
            platformName = "TikTok HD Video";
            platformIcon = "🎵";
        } else if (host.includes('youtube.com') || host.includes('youtu.be')) {
            detected = true;
            platformName = "YouTube Video / Short";
            platformIcon = "▶️";
        } else if (host.includes('facebook.com') || host.includes('fb.watch')) {
            detected = true;
            platformName = "Facebook Video / Reel";
            platformIcon = "📘";
        } else if (host.includes('twitter.com') || host.includes('x.com')) {
            detected = true;
            platformName = "Twitter / X Video";
            platformIcon = "🐦";
        } else if (host.includes('pinterest.com')) {
            detected = true;
            platformName = "Pinterest Pin Video";
            platformIcon = "📌";
        }

        if (detected) {
            detectionCard.classList.add('detected');
            detectionPlatformIcon.textContent = platformIcon;
            detectionPlatformLabel.textContent = platformName;
            detectionUrl.textContent = tab.title || tab.url;
            detectionUrl.title = tab.url;
            btnActiveDownload.style.display = 'flex';
            statusText.textContent = "Media Detected";
        } else {
            detectionPlatformIcon.textContent = "🌐";
            detectionPlatformLabel.textContent = "Generic Webpage";
            detectionUrl.textContent = "Paste any social link below";
            btnActiveDownload.style.display = 'none';
            statusText.textContent = "Idle";
        }
    });

    // 2. Active Tab Download Button
    btnActiveDownload.addEventListener('click', () => {
        if (!activeTabUrl) return;
        const target = `${VID_SAVOR_BASE}/?url=${encodeURIComponent(activeTabUrl)}`;
        chrome.tabs.create({ url: target });
    });

    // 3. Paste Button
    btnPaste.addEventListener('click', async () => {
        try {
            const clipText = await navigator.clipboard.readText();
            if (clipText) {
                manualUrlInput.value = clipText.trim();
                manualUrlInput.focus();
            }
        } catch (err) {
            manualUrlInput.focus();
        }
    });

    // 4. Manual Fetch Button
    btnFetchManual.addEventListener('click', () => {
        const val = manualUrlInput.value.trim();
        if (!val) {
            alert('Please paste a video URL first');
            return;
        }
        const target = `${VID_SAVOR_BASE}/?url=${encodeURIComponent(val)}`;
        chrome.tabs.create({ url: target });
    });

    // 5. Enter key in manual input
    manualUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnFetchManual.click();
        }
    });
});
