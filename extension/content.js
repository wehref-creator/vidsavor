/**
 * VidSavor Extension - Content Script
 * Injects floating 1-click Download buttons directly into social media reels and video pages
 */

(function () {
    'use strict';

    // Prevent duplicate injection
    if (window.__vidsavor_injected) return;
    window.__vidsavor_injected = true;

    const hostname = window.location.hostname;

    // Platform detection helper
    function getPlatform() {
        if (hostname.includes('instagram.com')) return 'instagram';
        if (hostname.includes('tiktok.com')) return 'tiktok';
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
        if (hostname.includes('facebook.com')) return 'facebook';
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
        if (hostname.includes('pinterest.com')) return 'pinterest';
        return 'unknown';
    }

    // Floating Widget Creator
    function createFloatingWidget() {
        if (document.getElementById('vidsavor-floating-pill')) return;

        const pill = document.createElement('div');
        pill.id = 'vidsavor-floating-pill';
        pill.title = 'Download this video with VidSavor';
        pill.innerHTML = `
            <div class="vidsavor-pill-inner">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span class="vidsavor-pill-text">Download HD</span>
            </div>
        `;

        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const currentUrl = window.location.href;
            
            // Visual feedback
            const textSpan = pill.querySelector('.vidsavor-pill-text');
            if (textSpan) textSpan.textContent = 'Opening...';

            chrome.runtime.sendMessage({
                action: 'OPEN_VIDSAVOR',
                url: currentUrl
            }, () => {
                setTimeout(() => {
                    if (textSpan) textSpan.textContent = 'Download HD';
                }, 2000);
            });
        });

        document.body.appendChild(pill);
    }

    // Check if current page is an active video / reel / post
    function shouldShowWidget() {
        const path = window.location.pathname;
        const platform = getPlatform();

        if (platform === 'instagram') {
            return path.includes('/reel/') || path.includes('/p/') || path.includes('/reels/');
        }
        if (platform === 'tiktok') {
            return path.includes('/video/') || path.includes('/@') || path.includes('/photo/');
        }
        if (platform === 'youtube') {
            return path.includes('/shorts/') || path.includes('/watch');
        }
        if (platform === 'facebook') {
            return path.includes('/reel') || path.includes('/videos/') || path.includes('/watch');
        }
        if (platform === 'twitter') {
            return path.includes('/status/');
        }
        if (platform === 'pinterest') {
            return path.includes('/pin/');
        }
        return false;
    }

    function checkAndMount() {
        if (shouldShowWidget()) {
            createFloatingWidget();
            const pill = document.getElementById('vidsavor-floating-pill');
            if (pill) pill.style.display = 'flex';
        } else {
            const pill = document.getElementById('vidsavor-floating-pill');
            if (pill) pill.style.display = 'none';
        }
    }

    // Initialize & observe URL changes (SPA navigation on Instagram, YouTube, TikTok)
    checkAndMount();
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            checkAndMount();
        }
    });
    observer.observe(document, { subtree: true, childList: true });

})();
