/**
 * VidSavor.com - Core Client Engine
 * Complete feature parity with FreeVideoSave.com + Modern Enhancements
 */

// 1. Service Worker & PWA Installation Engine
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('VidSavor Service Worker Active!', reg.scope))
            .catch(err => console.log('Service Worker Registration Error:', err));
    });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("VidSavor PWA: Official Google Install Prompt cached.");
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('VidSavor PWA: App installed successfully.');
});

// Deferred PWA install prompt trigger after user initiates download
window.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (event) => {
        const isDownloadClick = event.target.closest('#downloadButtonsContainer') || 
                                event.target.closest('.btn-download-new') || 
                                event.target.classList.contains('btn-download-new');

        if (isDownloadClick && deferredPrompt) {
            setTimeout(() => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('User accepted VidSavor PWA install.');
                        }
                        deferredPrompt = null;
                    });
                }
            }, 8000);
        }
    });

    // Input clear button handler
    const urlInput = document.getElementById('videoUrl');
    const clearBtn = document.getElementById('clearUrlBtn');
    if (urlInput && clearBtn) {
        urlInput.addEventListener('input', () => {
            clearBtn.style.display = urlInput.value.trim() ? 'block' : 'none';
        });
        clearBtn.addEventListener('click', () => {
            urlInput.value = '';
            clearBtn.style.display = 'none';
            urlInput.focus();
        });
    }
});

// 2. Navigation & UI Helpers
function scrollHero() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function pasteText() {
    const input = document.getElementById('videoUrl');
    const clearBtn = document.getElementById('clearUrlBtn');
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    try {
        const text = await navigator.clipboard.readText();
        input.value = text.trim();
        if (clearBtn) clearBtn.style.display = input.value ? 'block' : 'none';
        input.blur();
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(0, 0);
            input.scrollLeft = 0;
            window.scrollTo(scrollX, scrollY);
        }, 10);
    } catch (err) {
        input.focus();
        window.scrollTo(scrollX, scrollY);
        alert('Please paste manually using Ctrl+V or your device paste menu.');
    }
}

// 3. Platform & Mode Switcher
function changeMode(type) {
    const title = document.getElementById('mainTitle');
    const desc = document.getElementById('mainDesc');
    const input = document.getElementById('videoUrl');

    const configs = {
        'video': {
            title: '<span class="gradient">VidSavor</span> Downloader',
            desc: 'Download high quality videos, reels, photos & audio instantly from multiple social media platforms.',
            placeholder: 'Paste video, reel, or short link here...'
        },
        'audio': {
            title: '<span class="gradient">VidSavor</span> Audio Extractor',
            desc: 'Extract sound files, background music, and audio tracks directly into high-quality MP3 format instantly.',
            placeholder: 'Paste video or music link to extract MP3 audio...'
        },
        'photo': {
            title: '<span class="gradient">VidSavor</span> Photo Saver',
            desc: 'Save photos, carousel galleries, and thumbnails from Instagram, Pinterest, and Twitter in original HD quality.',
            placeholder: 'Paste image or photo post link here...'
        }
    }

    if (configs[type]) {
        if (title) title.innerHTML = configs[type].title;
        if (desc) desc.innerHTML = configs[type].desc;
        if (input) input.placeholder = configs[type].placeholder;
    }

    // Update active state in top-menu
    document.querySelectorAll('.menu-box').forEach(el => el.classList.remove('active'));
    const targetLink = document.querySelector(`.menu-box[data-mode="${type}"]`);
    if (targetLink) targetLink.classList.add('active');
}

// Enter key submit
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('videoUrl');
    if (input) {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                this.blur();
                downloadNow();
            }
        });
    }
});

// Cache for extracted media results to support category filtering
let currentResults = [];
let currentTitle = "Extracted Content";

// 4. Primary Extraction Pipeline
async function downloadNow() {
    const urlInput = document.getElementById('videoUrl').value.trim();
    const btn = document.getElementById('mainFetchBtn');
    const resultBox = document.getElementById('resultBox');
    const container = document.getElementById('downloadButtonsContainer');

    if (!urlInput) {
        alert('Please paste a valid video or post link first');
        return;
    }

    // Loading State with animation
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching...';
    btn.disabled = true;

    try {
        let response = await fetch('/api/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput })
        });

        // Fallback to /fetch if /api/fetch returned 404
        if (response.status === 404) {
            response = await fetch('/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput })
            });
        }

        const data = await response.json();

        if (data.status === 'success') {
            currentResults = data.results || [];
            currentTitle = data.title || "Extracted Content";

            // Render Preview Image or Video
            const previewContainer = document.getElementById('previewMediaContainer');
            if (previewContainer) {
                previewContainer.innerHTML = '';
                if (data.type === 'video' && data.download && !data.results?.length) {
                    const vid = document.createElement('video');
                    vid.src = data.download;
                    vid.controls = true;
                    vid.setAttribute('playsinline', '');
                    if (data.thumbnail) vid.poster = data.thumbnail;
                    previewContainer.appendChild(vid);
                } else if (data.thumbnail) {
                    const img = document.createElement('img');
                    img.src = data.thumbnail;
                    img.alt = currentTitle;
                    previewContainer.appendChild(img);
                }
            }

            // Render Title & Badges
            document.getElementById('videoTitle').textContent = currentTitle;
            
            const metaContainer = document.getElementById('mediaMetaContainer');
            if (metaContainer) {
                let badges = '';
                if (data.platform) {
                    badges += `<span class="media-meta-badge"><i class="fa-solid fa-globe"></i> ${data.platform.toUpperCase()}</span>`;
                }
                if (data.author) {
                    badges += `<span class="media-meta-badge"><i class="fa-solid fa-user"></i> ${data.author}</span>`;
                }
                if (data.duration) {
                    badges += `<span class="media-meta-badge"><i class="fa-solid fa-clock"></i> ${data.duration}</span>`;
                }
                metaContainer.innerHTML = badges;
            }

            // Clear previous buttons
            container.innerHTML = '';

            // If multi-item carousel or multiple streams, show "Download All" option
            if (data.results && data.results.length > 1) {
                const downloadAllBtn = document.createElement('button');
                downloadAllBtn.className = "download-btn";
                downloadAllBtn.style.width = "100%";
                downloadAllBtn.style.marginBottom = "20px";
                downloadAllBtn.style.justifyContent = "center";
                downloadAllBtn.innerHTML = `<i class="fa-solid fa-layer-group"></i> Download All Files (${data.results.length})`;
                downloadAllBtn.onclick = () => downloadEverything(data.results, currentTitle);
                container.appendChild(downloadAllBtn);
            }

            // Render category filter tabs if we have multiple kinds of media
            renderFilterTabs(data.results || []);

            // Render individual format/file cards
            renderResultCards(data.results || [], container, currentTitle);

            // Display and smoothly scroll to results
            resultBox.style.display = 'block';
            setTimeout(() => {
                resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);

        } else {
            const msg = (data.message || '').toLowerCase();
            if (msg.includes('not found') || msg.includes('media') || msg.includes('private') || !data.message) {
                alert('Media not found! Sometimes private or unstable links take a few attempts. Please retry 2–3 times or make sure the post is from a public account.');
            } else {
                alert('Error: ' + data.message);
            }
        }
    } catch (err) {
        console.error("VidSavor Fetch Error:", err);
        alert('Server connection error. Please verify the VidSavor backend is running.');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
        btn.disabled = false;
    }
}

// 5. Render Result Cards
function renderResultCards(items, container, title) {
    if (!items || items.length === 0) {
        container.innerHTML += '<p style="color:#6b7280; font-size:14px; text-align:center; padding:20px;">No streams available for this post.</p>';
        return;
    }

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = "media-item-card";
        card.setAttribute('data-type', item.type || 'video');

        const left = document.createElement('div');
        left.className = "media-info-left";

        let iconClass = "fa-solid fa-file-video";
        let typeBadgeClass = "";
        if (item.type === 'audio') {
            iconClass = "fa-solid fa-music";
            typeBadgeClass = "audio";
        } else if (item.type === 'photo') {
            iconClass = "fa-solid fa-image";
            typeBadgeClass = "photo";
        }

        left.innerHTML = `
            <div class="media-type-icon ${typeBadgeClass}">
                <i class="${iconClass}"></i>
            </div>
            <div class="media-details">
                <h4>${item.quality || (item.type ? item.type.toUpperCase() : 'Media')}</h4>
                <span>${item.format ? item.format.toUpperCase() : 'MP4'} • ${item.size || 'HD Direct'}</span>
            </div>
        `;

        const dlBtn = document.createElement('button');
        dlBtn.className = "btn-download-new";
        dlBtn.innerHTML = `<i class="fa-solid fa-circle-down"></i> Download`;
        dlBtn.onclick = () => {
            const ext = item.format || (item.type === 'video' ? 'mp4' : (item.type === 'audio' ? 'mp3' : 'jpg'));
            const filename = `VidSavor_${sanitizeFilename(title)}_${item.quality || 'File'}.${ext}`;
            triggerDirectDownload(item.url, item.type, filename);
        };

        card.appendChild(left);
        card.appendChild(dlBtn);
        container.appendChild(card);
    });
}

// Render format filter tabs (All, Videos, Audio, Photos)
function renderFilterTabs(items) {
    const tabsContainer = document.getElementById('formatFilterTabs');
    if (!tabsContainer) return;

    const types = new Set(items.map(i => i.type || 'video'));
    if (types.size <= 1) {
        tabsContainer.style.display = 'none';
        return;
    }

    tabsContainer.style.display = 'flex';
    tabsContainer.innerHTML = `
        <button class="tab-pill active" onclick="filterResults('all')">All Files (${items.length})</button>
        ${types.has('video') ? `<button class="tab-pill" onclick="filterResults('video')"><i class="fa-solid fa-video"></i> Videos</button>` : ''}
        ${types.has('audio') ? `<button class="tab-pill" onclick="filterResults('audio')"><i class="fa-solid fa-music"></i> Audio MP3</button>` : ''}
        ${types.has('photo') ? `<button class="tab-pill" onclick="filterResults('photo')"><i class="fa-solid fa-image"></i> Photos</button>` : ''}
    `;
}

function filterResults(type) {
    document.querySelectorAll('.tab-pill').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    const cards = document.querySelectorAll('.media-item-card');
    cards.forEach(card => {
        if (type === 'all' || card.getAttribute('data-type') === type) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function sanitizeFilename(name) {
    return (name || 'Media').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
}

// 6. Direct Client & Proxy Download Trigger
async function triggerDirectDownload(url, type, filename) {
    try {
        // Use our proxy-download endpoint to avoid CORS issues and force instant disk saving
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
        
        // Attempt fetch blob first for silent download
        const response = await fetch(proxyUrl);
        if (response.ok) {
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
            }, 500);
            return;
        }
    } catch (err) {
        console.warn("Direct blob download failed, falling back to window.open:", err);
    }

    // Fallback: Direct link navigation
    const a = document.createElement('a');
    a.href = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Sequential batch download for albums / carousels
async function downloadEverything(files, title) {
    for (let i = 0; i < files.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 600));
        const item = files[i];
        const ext = item.format || (item.type === 'video' ? 'mp4' : (item.type === 'audio' ? 'mp3' : 'jpg'));
        const filename = `VidSavor_${sanitizeFilename(title)}_Part_${i + 1}.${ext}`;
        await triggerDirectDownload(item.url, item.type, filename);
    }
}

// 7. Legal Modal Popup Controller
function openLegal(type) {
    const popup = document.getElementById('popupOverlay');
    const title = document.getElementById('popupTitle');
    const content = document.getElementById('popupContent');
    if (!popup || !title || !content) return;

    popup.style.display = 'flex';

    if (type === 'privacy') {
        title.innerHTML = 'Privacy Policy';
        content.innerHTML = `
            <p>At <strong>VidSavor</strong>, user privacy is our highest priority. We do not require accounts, logins, personal identity credentials, or passwords.</p>
            <h3>Information Usage</h3>
            <ul>
                <li>We only process publicly accessible media links requested directly by the user.</li>
                <li>No downloaded media or user video streams are stored on our servers.</li>
                <li>We never sell, rent, or share personal data with third-party brokers.</li>
            </ul>
            <h3>Client-Side Security</h3>
            <p>All extraction requests run in client sandbox environments or transient proxy pipelines without persistent database logs.</p>
        `;
    } else if (type === 'terms') {
        title.innerHTML = 'Terms of Service';
        content.innerHTML = `
            <p>By using <strong>VidSavor.com</strong>, you agree to use our web utility responsibly and solely for lawful personal archiving purposes.</p>
            <h3>User Responsibilities</h3>
            <ul>
                <li>Do not download copyrighted content without explicit authorization from original rights holders.</li>
                <li>Respect original content creators, public usage limits, and platform terms of service.</li>
            </ul>
            <h3>Service Availability</h3>
            <p>VidSavor provides this web tool free of charge and as-is. Features may be updated, enhanced, or maintained periodically without prior notice.</p>
        `;
    } else if (type === 'dmca') {
        title.innerHTML = 'DMCA Copyright Policy';
        content.innerHTML = `
            <p><strong>VidSavor</strong> complies with 17 U.S.C. § 512 and adheres to the Digital Millennium Copyright Act (DMCA).</p>
            <h3>No Hosting Policy</h3>
            <p>VidSavor does not host, store, or re-transmit copyrighted video or audio content on its servers. All extraction is done transiently from public third-party addresses.</p>
            <h3>Takedown Requests</h3>
            <p>If you are a copyright owner or authorized agent and wish to restrict links to your content, please reach out to our copyright agent at: <strong>support@vidsavor.com</strong>.</p>
        `;
    } else if (type === 'help') {
        title.innerHTML = 'Help Center';
        content.innerHTML = `
            <h3>How To Download Any Video?</h3>
            <ul>
                <li><strong>Step 1:</strong> Copy the public link of the video, reel, post, or photo from your app or browser.</li>
                <li><strong>Step 2:</strong> Paste the copied link into the VidSavor search box above.</li>
                <li><strong>Step 3:</strong> Click the "Download" button to generate direct HD download links.</li>
            </ul>
            <h3>Need Assistance?</h3>
            <p>Contact our support team at: <b>support@vidsavor.com</b></p>
        `;
    } else if (type === 'about') {
        title.innerHTML = 'About VidSavor';
        content.innerHTML = `
            <p><strong>VidSavor</strong> is an ultra-fast, modern online media utility designed to extract public videos, short clips, reels, photos, and audio files in high clarity.</p>
            <p>Our platform operates without requiring any software installations or logins, making web media archiving effortless across mobile and desktop devices.</p>
        `;
    }
}

function closePopup() {
    const popup = document.getElementById('popupOverlay');
    if (popup) popup.style.display = 'none';
}

window.addEventListener('click', (e) => {
    const popup = document.getElementById('popupOverlay');
    if (e.target === popup) {
        popup.style.display = 'none';
    }
});
