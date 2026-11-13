/**
 * VidSavor.com - Core Client Engine
 * Google Antigravity Particle Physics, Mega Menus, Auto-Fetch & Downloader
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
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
});

// ==========================================================================
// 2. GOOGLE ANTIGRAVITY HERO MOUSE PARTICLE PHYSICS SIMULATION
// ==========================================================================
function initHeroParticles() {
    const canvas = document.getElementById('antigravityCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;
    let animationFrameId = null;

    // Mouse coordinates and tracking
    const mouse = {
        x: -9999,
        y: -9999,
        targetX: -9999,
        targetY: -9999,
        radius: 130, // Influence radius
        isHovered: false
    };

    // Google Antigravity Color Palette
    const colors = [
        '#4285F4', // Google Blue
        '#EA4335', // Google Red
        '#FBBC04', // Google Yellow
        '#34A853', // Google Green
        '#5F6368', // Slate
        '#9AA0A6'  // Light Grey
    ];

    class Particle {
        constructor(x, y) {
            this.originX = x;
            this.originY = y;
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.radius = Math.random() * 2.2 + 1.2;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.alpha = Math.random() * 0.4 + 0.35;
            this.spring = 0.035;   // Pull back towards equilibrium
            this.damping = 0.90;  // Momentum damping
            this.oscSpeed = Math.random() * 0.02 + 0.01;
            this.oscRadius = Math.random() * 6 + 2;
            this.angle = Math.random() * Math.PI * 2;
        }

        update() {
            // Ambient zero-gravity floating oscillation
            this.angle += this.oscSpeed;
            const targetOriginX = this.originX + Math.cos(this.angle) * this.oscRadius;
            const targetOriginY = this.originY + Math.sin(this.angle) * this.oscRadius;

            // Distance from mouse cursor
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Antigravity Mouse Repulsion Force
            if (mouse.isHovered && dist < mouse.radius && dist > 0) {
                const force = (1 - dist / mouse.radius) * 3.2;
                const angle = Math.atan2(dy, dx);
                this.vx += Math.cos(angle) * force;
                this.vy += Math.sin(angle) * force;
            }

            // Restoring spring force towards equilibrium
            const homeDx = targetOriginX - this.x;
            const homeDy = targetOriginY - this.y;
            this.vx += homeDx * this.spring;
            this.vy += homeDy * this.spring;

            // Apply damping / inertia
            this.vx *= this.damping;
            this.vy *= this.damping;

            this.x += this.vx;
            this.y += this.vy;
        }

        draw() {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.alpha;
            ctx.fill();
            ctx.restore();
        }
    }

    let particles = [];

    function resize() {
        const hero = canvas.parentElement;
        if (!hero) return;

        width = hero.clientWidth;
        height = hero.clientHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        initParticles();
    }

    function initParticles() {
        particles = [];
        // Spawn 80 particles distributed across hero space
        const count = Math.min(Math.floor((width * height) / 9000), 85);
        for (let i = 0; i < count; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            particles.push(new Particle(x, y));
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Update & draw particles
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();

            // Connect nearby particles with subtle gossamer lines
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 75) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = '#5f6368';
                    ctx.globalAlpha = (1 - dist / 75) * 0.12;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    // Hero Mouse Movement Listeners
    const hero = canvas.parentElement;
    if (hero) {
        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
            mouse.isHovered = true;
        });

        hero.addEventListener('mouseleave', () => {
            mouse.isHovered = false;
            mouse.x = -9999;
            mouse.y = -9999;
        });

        // Touch support for mobile devices
        hero.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const rect = hero.getBoundingClientRect();
                mouse.x = e.touches[0].clientX - rect.left;
                mouse.y = e.touches[0].clientY - rect.top;
                mouse.isHovered = true;
            }
        }, { passive: true });

        hero.addEventListener('touchend', () => {
            mouse.isHovered = false;
            mouse.x = -9999;
            mouse.y = -9999;
        });
    }

    window.addEventListener('resize', resize);
    resize();
    animate();
}

// ==========================================================================
// 3. SEAMLESS MEGA DROPDOWN MENU INTERACTION
// ==========================================================================
function initMegaMenus() {
    const wrappers = document.querySelectorAll('.antigravity-dropdown-wrapper');

    wrappers.forEach(wrapper => {
        const btn = wrapper.querySelector('.antigravity-nav-btn');
        if (!btn) return;

        // Toggle on click
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');

            // Close other wrappers
            wrappers.forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });

            wrapper.classList.toggle('open', !isOpen);
        });
    });

    // Close any open dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        wrappers.forEach(wrapper => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
            }
        });
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            wrappers.forEach(wrapper => wrapper.classList.remove('open'));
        }
    });
}

// ==========================================================================
// 4. FAQ ACCORDION INTERACTION
// ==========================================================================
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const btn = item.querySelector('.faq-question');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Optionally keep one open at a time
            faqItems.forEach(other => {
                if (other !== item) other.classList.remove('active');
            });

            item.classList.toggle('active', !isActive);
        });
    });
}

// ==========================================================================
// 5. INPUT, AUTO-FETCH ON PASTE & EXTRACTION PIPELINE
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Google Antigravity interactive features
    initHeroParticles();
    initMegaMenus();
    initFaqAccordion();

    // 2. Input clear & auto-fetch listeners
    const urlInput = document.getElementById('videoUrl');
    const clearBtn = document.getElementById('clearUrlBtn');

    if (urlInput) {
        urlInput.addEventListener('input', () => {
            if (clearBtn) clearBtn.style.display = urlInput.value.trim() ? 'block' : 'none';
        });

        // Automatically start fetching when user pastes into the input!
        urlInput.addEventListener('paste', () => {
            setTimeout(() => {
                const val = urlInput.value.trim();
                if (val.startsWith('http://') || val.startsWith('https://')) {
                    if (clearBtn) clearBtn.style.display = 'block';
                    downloadNow();
                }
            }, 60);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                urlInput.value = '';
                clearBtn.style.display = 'none';
                urlInput.focus();
            });
        }

        // Enter key submit
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                urlInput.blur();
                downloadNow();
            }
        });
    }
});

function scrollHero() {
    const el = document.getElementById('downloadSection') || document.querySelector('.hero');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function toggleMobileNav() {
    const nav = document.querySelector('.antigravity-nav');
    if (nav) nav.classList.toggle('mobile-active');
}

async function pasteText() {
    const input = document.getElementById('videoUrl');
    const clearBtn = document.getElementById('clearUrlBtn');

    try {
        const text = await navigator.clipboard.readText();
        const clean = text.trim();
        input.value = clean;
        if (clearBtn) clearBtn.style.display = clean ? 'block' : 'none';

        // Auto-fetch immediately upon clicking Paste if valid URL!
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
            downloadNow();
            return;
        }
        input.focus();
    } catch (err) {
        input.focus();
        alert('Please paste using Ctrl+V or your device paste option.');
    }
}

function copyMediaLink() {
    const urlInput = document.getElementById('videoUrl')?.value.trim();
    if (urlInput) {
        navigator.clipboard.writeText(urlInput).then(() => {
            alert('Post link copied to clipboard!');
        });
    }
}

function shareMedia() {
    const urlInput = document.getElementById('videoUrl')?.value.trim();
    if (navigator.share && urlInput) {
        navigator.share({
            title: document.getElementById('videoTitle')?.textContent || 'VidSavor Download',
            url: urlInput
        }).catch(() => {});
    } else {
        copyMediaLink();
    }
}

// Category cache for extracted media results
let currentResults = [];
let currentTitle = "Extracted Content";

// Instant Direct Download Engine (Using grapweb Hostinger streaming attachment engine for TikTok, Instagram, Facebook, and YouTube)
function resolveDownloadUrl(streamUrl, filename, item = null) {
    if (!streamUrl) return '#';
    const currentPostUrl = document.getElementById('videoUrl')?.value?.trim() || '';
    const safeTitle = (filename || 'video').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = (filename || '').split('.').pop() || 'mp4';

    // 1. TIKTOK: Route through dedicated grapweb.com/tiktok/download.php engine (Hostinger cURL attachment streaming)
    const isTikTok = currentPostUrl.includes('tiktok.com') ||
                     streamUrl.includes('tiktok') ||
                     streamUrl.includes('byteoversea') ||
                     streamUrl.includes('tikwm') ||
                     streamUrl.includes('musical.ly') ||
                     streamUrl.includes('rapidcdn');
    if (isTikTok) {
        return `https://grapweb.com/tiktok/download.php?url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(safeTitle)}&ext=${encodeURIComponent(ext)}`;
    }

    // 2. INSTAGRAM & FACEBOOK: Route through dedicated grapweb.com/facebook/download.php engine (supports cdninstagram.com, fbcdn.net, facebook.com)
    const isMeta = currentPostUrl.includes('instagram.com') ||
                   currentPostUrl.includes('instagr.am') ||
                   currentPostUrl.includes('facebook.com') ||
                   currentPostUrl.includes('fb.watch') ||
                   currentPostUrl.includes('fb.com') ||
                   streamUrl.includes('cdninstagram.com') ||
                   streamUrl.includes('instagram.com') ||
                   streamUrl.includes('fbcdn.net') ||
                   streamUrl.includes('facebook.com');
    if (isMeta) {
        return `https://grapweb.com/facebook/download.php?url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(safeTitle)}&ext=${encodeURIComponent(ext)}`;
    }

    // 3. DIRECT VIDSSAVE RESOLVED LINK (already converted and unrestricted):
    if (streamUrl.includes('vidssave.com') && streamUrl.includes('/tmp/recycle/')) {
        return streamUrl;
    }

    // 4. YOUTUBE (dynamic resolution trigger):
    const isYouTube = currentPostUrl.includes('youtube.com') ||
                      currentPostUrl.includes('youtu.be') ||
                      (item && item.token) ||
                      streamUrl.startsWith('Z0ve');
    if (isYouTube) {
        return 'javascript:void(0);';
    }

    const params = new URLSearchParams({
        url: streamUrl,
        filename: filename || 'video.mp4'
    });
    if (currentPostUrl) {
        params.set('referer', currentPostUrl);
    }
    return `/api/proxy-download?${params.toString()}`;
}

async function triggerInstantDownload(streamUrl, filename, btnElement, item = null) {
    if (!streamUrl && (!item || !item.token)) {
        alert('Download stream URL not found.');
        return;
    }

    const currentPostUrl = document.getElementById('videoUrl')?.value?.trim() || '';
    const safeTitle = (filename || 'video').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = (filename || '').split('.').pop() || 'mp4';

    // Check if this is a YouTube stream requiring cloud task conversion
    const isYouTube = currentPostUrl.includes('youtube.com') ||
                      currentPostUrl.includes('youtu.be') ||
                      (item && item.token) ||
                      (streamUrl && streamUrl.startsWith('Z0ve'));

    if (isYouTube) {
        const token = (item && item.token) ? item.token : streamUrl;
        const origHTML = btnElement ? btnElement.innerHTML : '';
        if (btnElement) {
            btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Preparing...</span>';
            btnElement.style.pointerEvents = 'none';
        }

        try {
            const res = await fetch('/api/resolve-youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token,
                    title: safeTitle,
                    format: ext,
                    url: currentPostUrl
                })
            });
            const data = await res.json();
            if (data && data.status === 'success' && data.download_url) {
                if (btnElement) {
                    btnElement.innerHTML = '<i class="fa-solid fa-check"></i> <span>Started!</span>';
                    btnElement.style.pointerEvents = 'auto';
                    setTimeout(() => {
                        btnElement.innerHTML = origHTML || '<i class="fa-solid fa-download"></i> <span>Download</span>';
                    }, 4000);
                }

                // Trigger direct file download
                const dlAnchor = document.createElement('a');
                dlAnchor.style.display = 'none';
                dlAnchor.href = data.download_url;
                dlAnchor.setAttribute('download', data.filename || filename);
                document.body.appendChild(dlAnchor);
                dlAnchor.click();
                setTimeout(() => dlAnchor.remove(), 2500);
                return;
            } else {
                throw new Error((data && data.message) ? data.message : 'Conversion server timeout');
            }
        } catch (err) {
            console.error('YouTube resolution error:', err);
            if (btnElement) {
                btnElement.innerHTML = origHTML || '<i class="fa-solid fa-download"></i> <span>Download</span>';
                btnElement.style.pointerEvents = 'auto';
            }
            alert('Could not prepare YouTube stream: ' + (err.message || 'Server timeout. Please retry.'));
            return;
        }
    }

    // Standard Direct Download Flow (TikTok, Instagram, Facebook, Pinterest, Twitter)
    const downloadUrl = resolveDownloadUrl(streamUrl, filename, item);

    if (btnElement) {
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> <span>Started!</span>';
        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
        }, 3500);
    }

    // Trigger native browser attachment download via invisible anchor
    const dlAnchor = document.createElement('a');
    dlAnchor.style.display = 'none';
    dlAnchor.href = downloadUrl;
    dlAnchor.setAttribute('download', filename);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    setTimeout(() => dlAnchor.remove(), 2000);
}

// Primary extraction pipeline
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

        // Fallback to /fetch if /api/fetch returned 404 or 405
        if (!response.ok) {
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

            // Set Title & Details
            const titleEl = document.getElementById('videoTitle');
            if (titleEl) titleEl.textContent = currentTitle;

            const durationEl = document.getElementById('videoDuration');
            if (durationEl) {
                durationEl.textContent = data.duration ? `Duration: ${data.duration}` : 'HD Quality Available';
            }

            const platformBadge = document.getElementById('platformBadge');
            if (platformBadge) {
                platformBadge.textContent = data.source ? data.source.toUpperCase() : 'MEDIA';
            }

            // Ensure bulletproof modern SaveFrom + Antigravity styles are active
            if (!document.getElementById('vidsavor-download-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'vidsavor-download-styles';
                styleEl.textContent = `
                    .download-item-row {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        padding: 14px 20px !important;
                        background: #f8fafc !important;
                        border: 1.5px solid #e2e8f0 !important;
                        border-radius: 16px !important;
                        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
                        cursor: pointer !important;
                        gap: 16px !important;
                        margin-bottom: 12px !important;
                        box-sizing: border-box !important;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.03) !important;
                    }
                    .download-item-row:hover {
                        border-color: #1a73e8 !important;
                        background: #ffffff !important;
                        box-shadow: 0 4px 16px rgba(26, 115, 232, 0.12) !important;
                        transform: translateY(-2px) !important;
                    }
                    .download-item-row.primary-row {
                        border-color: #1a73e8 !important;
                        background: #f0f7ff !important;
                        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.1) !important;
                    }
                    .download-item-row .row-left {
                        display: flex !important;
                        align-items: center !important;
                        gap: 14px !important;
                        flex: 1 !important;
                        min-width: 0 !important;
                    }
                    .download-item-row .row-icon {
                        width: 44px !important;
                        height: 44px !important;
                        border-radius: 12px !important;
                        background: #e8f0fe !important;
                        color: #1a73e8 !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        font-size: 18px !important;
                        flex-shrink: 0 !important;
                    }
                    .download-item-row .row-info {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 4px !important;
                        text-align: left !important;
                        min-width: 0 !important;
                    }
                    .download-item-row .row-title-wrap {
                        display: flex !important;
                        align-items: center !important;
                        gap: 8px !important;
                        flex-wrap: wrap !important;
                    }
                    .download-item-row .row-title {
                        font-size: 15px !important;
                        font-weight: 700 !important;
                        color: #1e293b !important;
                        letter-spacing: -0.01em !important;
                    }
                    .download-item-row .sound-tag {
                        display: inline-flex !important;
                        align-items: center !important;
                        gap: 4px !important;
                        padding: 2px 8px !important;
                        background: #dcfce7 !important;
                        color: #15803d !important;
                        font-size: 11px !important;
                        font-weight: 600 !important;
                        border-radius: 9999px !important;
                    }
                    .download-item-row .sound-tag.muted {
                        background: #f1f5f9 !important;
                        color: #64748b !important;
                    }
                    .download-item-row .row-sub {
                        font-size: 12px !important;
                        color: #64748b !important;
                    }
                    .download-item-row .row-right {
                        display: flex !important;
                        align-items: center !important;
                        gap: 12px !important;
                        flex-shrink: 0 !important;
                    }
                    .download-item-row .row-size-pill {
                        font-size: 12.5px !important;
                        font-weight: 600 !important;
                        padding: 6px 14px !important;
                        border-radius: 9999px !important;
                        background: #f1f5f9 !important;
                        color: #334155 !important;
                        white-space: nowrap !important;
                        border: 1px solid #e2e8f0 !important;
                    }
                    .download-item-row.primary-row .row-size-pill {
                        background: #e0f2fe !important;
                        color: #0369a1 !important;
                        border-color: #bae6fd !important;
                    }
                    .download-item-row .btn-row-download {
                        display: inline-flex !important;
                        align-items: center !important;
                        gap: 8px !important;
                        padding: 10px 22px !important;
                        background: #1a73e8 !important;
                        color: #ffffff !important;
                        border: none !important;
                        border-radius: 9999px !important;
                        font-size: 14px !important;
                        font-weight: 600 !important;
                        cursor: pointer !important;
                        transition: all 0.2s ease !important;
                        white-space: nowrap !important;
                        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.25) !important;
                    }
                    .download-item-row .btn-row-download:hover {
                        background: #1557b0 !important;
                        box-shadow: 0 4px 14px rgba(26, 115, 232, 0.4) !important;
                        transform: translateY(-1px) !important;
                    }
                `;
                document.head.appendChild(styleEl);
            }

            // Render SaveFrom-Style Download Rows (Right on the page, NO redirection)
            if (container) {
                container.innerHTML = '';

                // Handle single stream download
                if (data.download && (!data.results || data.results.length === 0)) {
                    const singleRow = document.createElement('div');
                    singleRow.className = 'download-item-row primary-row';
                    const safeTitle = (currentTitle || 'vidsavor').slice(0, 45).replace(/[^a-zA-Z0-9_-]/g, '_');
                    const cleanName = `${safeTitle}.mp4`;
                    const singleDlUrl = resolveDownloadUrl(data.download, cleanName);
                    singleRow.innerHTML = `
                        <div class="row-left">
                            <div class="row-icon"><i class="fa-solid fa-video"></i></div>
                            <div class="row-info">
                                <div class="row-title-wrap">
                                    <span class="row-title">Full HD Video (MP4)</span>
                                    <span class="sound-tag"><i class="fa-solid fa-volume-high"></i> Sound On</span>
                                </div>
                                <span class="row-sub">Instant Watermark-Free Direct Save</span>
                            </div>
                        </div>
                        <div class="row-right">
                            <span class="row-size-pill">Original HD</span>
                            <a href="${singleDlUrl}" class="btn-row-download" download="${cleanName}">
                                <i class="fa-solid fa-download"></i> <span>Download</span>
                            </a>
                        </div>
                    `;
                    const singleDownloadBtn = singleRow.querySelector('.btn-row-download');
                    singleDownloadBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        triggerInstantDownload(data.download, cleanName, singleDownloadBtn);
                    });
                    singleRow.addEventListener('click', (e) => {
                        if (e.target !== singleDownloadBtn && !singleDownloadBtn.contains(e.target)) {
                            triggerInstantDownload(data.download, cleanName, singleDownloadBtn);
                        }
                    });
                    container.appendChild(singleRow);
                }

                // Handle multi-resolution streams
                if (data.results && data.results.length > 0) {
                    data.results.forEach((item, index) => {
                        const rowEl = document.createElement('div');
                        const isPrimary = index === 0;

                        // Accurate extension and type detection
                        const isPhoto = item.type === 'photo' || item.format === 'jpg' || item.format === 'jpeg' || item.format === 'png' || (item.quality && (item.quality.toLowerCase().includes('poster') || item.quality.toLowerCase().includes('cover') || item.quality.toLowerCase().includes('photo')));
                        const isAudio = item.type === 'audio' || item.format === 'mp3' || item.format === 'm4a' || (item.quality && item.quality.toLowerCase().includes('audio'));

                        let ext = 'mp4';
                        if (isPhoto) {
                            ext = (item.format && item.format !== 'video') ? item.format : 'jpg';
                        } else if (isAudio) {
                            ext = (item.format && item.format !== 'video') ? item.format : 'mp3';
                        } else {
                            ext = item.format || item.ext || 'mp4';
                        }

                        // Clean quality label
                        let rawQ = item.quality || (isAudio ? 'High Audio' : (isPhoto ? 'HD Photo' : 'HD Video'));
                        let cleanQ = rawQ.replace(/\s+(MP4|MP3|JPG|JPEG|PNG)$/i, '').trim();

                        const safeTitle = (currentTitle || 'vidsavor').slice(0, 45).replace(/[^a-zA-Z0-9_-]/g, '_');
                        const cleanFilename = `${safeTitle}_${index}_${cleanQ.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
                        const rowDlUrl = resolveDownloadUrl(item.url, cleanFilename, item);

                        let iconClass = 'fa-solid fa-video';
                        let soundBadge = '';
                        let subText = 'Watermark-Free Video Direct Save';

                        if (isPhoto) {
                            iconClass = 'fa-regular fa-image';
                            soundBadge = '<span class="sound-tag muted"><i class="fa-regular fa-image"></i> HD Image</span>';
                            subText = 'Original High-Resolution Image';
                        } else if (isAudio) {
                            iconClass = 'fa-solid fa-music';
                            soundBadge = '<span class="sound-tag"><i class="fa-solid fa-music"></i> Stereo Audio</span>';
                            subText = 'Original High-Quality Audio Track';
                        } else {
                            if (item.has_audio !== false) {
                                soundBadge = '<span class="sound-tag"><i class="fa-solid fa-volume-high"></i> Sound On</span>';
                                subText = 'Full HD Video with Audio Included';
                            } else {
                                soundBadge = '<span class="sound-tag muted"><i class="fa-solid fa-volume-xmark"></i> Video Only</span>';
                                subText = 'Muted Video Stream';
                            }
                        }

                        rowEl.className = `download-item-row ${isPrimary ? 'primary-row' : ''}`;
                        rowEl.innerHTML = `
                            <div class="row-left">
                                <div class="row-icon">
                                    <i class="${iconClass}"></i>
                                </div>
                                <div class="row-info">
                                    <div class="row-title-wrap">
                                        <span class="row-title">${cleanQ} (${ext.toUpperCase()})</span>
                                        ${soundBadge}
                                    </div>
                                    <span class="row-sub">${subText}</span>
                                </div>
                            </div>
                            <div class="row-right">
                                <span class="row-size-pill">${item.size || 'HD File'}</span>
                                <a href="${rowDlUrl}" class="btn-row-download" download="${cleanFilename}">
                                    <i class="fa-solid fa-download"></i> <span>Download</span>
                                </a>
                            </div>
                        `;

                        const downloadBtn = rowEl.querySelector('.btn-row-download');
                        downloadBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            triggerInstantDownload(item.url, cleanFilename, downloadBtn, item);
                        });
                        rowEl.addEventListener('click', (e) => {
                            if (e.target !== downloadBtn && !downloadBtn.contains(e.target)) {
                                triggerInstantDownload(item.url, cleanFilename, downloadBtn, item);
                            }
                        });

                        container.appendChild(rowEl);
                    });
                }
            }

            // Show 2-Column Result Box smoothly
            resultBox.style.display = 'block';
            resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            alert('Error: ' + (data.message || 'Unable to extract media from this link.'));
        }
    } catch (err) {
        console.error("Extraction error:", err);
        alert('Server communication error. Please verify the URL and try again.');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-download"></i> <span>Download</span>';
        btn.disabled = false;
    }
}

// Expose functions globally for inline HTML onclick handlers
window.downloadNow = downloadNow;
window.pasteText = pasteText;
window.scrollHero = scrollHero;
window.toggleMobileNav = toggleMobileNav;
window.copyMediaLink = copyMediaLink;
window.shareMedia = shareMedia;
