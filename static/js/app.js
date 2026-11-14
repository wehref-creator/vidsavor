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
            e.preventDefault();
            const isOpen = wrapper.classList.contains('open');

            // Close other wrappers
            wrappers.forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });

            wrapper.classList.toggle('open', !isOpen);
        });
    });

    // Close any open dropdowns when clicking outside (desktop only)
    document.addEventListener('click', (e) => {
        // Do not auto-close accordions if user taps inside the mobile navigation drawer
        if (document.querySelector('.antigravity-nav.mobile-active')) {
            return;
        }
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
            const nav = document.querySelector('.antigravity-nav');
            if (nav && nav.classList.contains('mobile-active')) {
                toggleMobileNav();
            }
        }
    });

    // Close mobile nav when clicking any link inside it
    document.querySelectorAll('.antigravity-nav a').forEach(link => {
        link.addEventListener('click', () => {
            const nav = document.querySelector('.antigravity-nav');
            if (nav && nav.classList.contains('mobile-active')) {
                toggleMobileNav();
            }
        });
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

        // 3. Auto-handle incoming shared URL from Web Share Target, PWA, Extension, or Mobile Share Sheet
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const rawShare = urlParams.get('url') || urlParams.get('text') || urlParams.get('link') || urlParams.get('video_url');

            if (rawShare) {
                // Extract actual http(s) URL in case social media app included trailing / leading text
                const match = rawShare.match(/https?:\/\/[^\s"']+/i);
                const targetUrl = match ? match[0] : rawShare.trim();

                if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
                    urlInput.value = targetUrl;
                    if (clearBtn) clearBtn.style.display = 'block';
                    // Scroll to hero and auto-trigger downloadNow smoothly
                    setTimeout(() => {
                        scrollHero();
                        downloadNow();
                    }, 150);
                }
            }
        } catch (shareErr) {
            console.warn('Share target parsing error:', shareErr);
        }
    }
});

function scrollHero() {
    const el = document.getElementById('downloadSection') || document.querySelector('.hero');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function toggleMobileNav() {
    const nav = document.querySelector('.antigravity-nav');
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    const header = document.querySelector('header');
    if (nav) {
        const isActive = nav.classList.toggle('mobile-active');
        if (header) header.classList.toggle('mobile-nav-active', isActive);
        document.body.classList.toggle('mobile-nav-active', isActive);

        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = isActive ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
            }
            toggleBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }

        // When opening on mobile, automatically open the first accordion ("All Platforms")
        // so the user immediately sees all available platforms!
        if (isActive) {
            const firstWrapper = nav.querySelector('.antigravity-dropdown-wrapper');
            if (firstWrapper) {
                firstWrapper.classList.add('open');
            }
        }

        document.body.style.overflow = isActive ? 'hidden' : '';
    }
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
    let rawInput = document.getElementById('videoUrl').value.trim();
    const btn = document.getElementById('mainFetchBtn');
    const resultBox = document.getElementById('resultBox');
    const container = document.getElementById('downloadButtonsContainer');

    if (!rawInput) {
        alert('Please paste a valid video or post link first');
        return;
    }

    // Auto-extract pure HTTP(S) link in case user pasted social share text (e.g. "Check out this reel https://...")
    const urlMatch = rawInput.match(/https?:\/\/[^\s"']+/i);
    const urlInput = urlMatch ? urlMatch[0] : rawInput;
    if (urlMatch && urlMatch[0] !== rawInput) {
        document.getElementById('videoUrl').value = urlInput;
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
                    @media (max-width: 640px) {
                        .download-item-row {
                            flex-direction: column !important;
                            align-items: stretch !important;
                            padding: 14px !important;
                            gap: 12px !important;
                            border-radius: 16px !important;
                        }
                        .download-item-row .row-left {
                            width: 100% !important;
                            display: flex !important;
                            align-items: flex-start !important;
                            gap: 12px !important;
                        }
                        .download-item-row .row-icon {
                            width: 40px !important;
                            height: 40px !important;
                            min-width: 40px !important;
                            font-size: 16px !important;
                            border-radius: 10px !important;
                        }
                        .download-item-row .row-info {
                            flex: 1 !important;
                            min-width: 0 !important;
                        }
                        .download-item-row .row-title-wrap {
                            flex-wrap: wrap !important;
                            gap: 6px !important;
                            margin-bottom: 4px !important;
                        }
                        .download-item-row .row-title {
                            font-size: 14.5px !important;
                            line-height: 1.3 !important;
                        }
                        .download-item-row .sound-tag {
                            font-size: 11px !important;
                            padding: 2px 7px !important;
                        }
                        .download-item-row .row-sub {
                            font-size: 12px !important;
                            line-height: 1.35 !important;
                        }
                        .download-item-row .row-right {
                            width: 100% !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: space-between !important;
                            gap: 10px !important;
                            padding-top: 10px !important;
                            border-top: 1px dashed #e2e8f0 !important;
                        }
                        .download-item-row .row-size-pill {
                            font-size: 12px !important;
                            padding: 6px 10px !important;
                            border-radius: 8px !important;
                        }
                        .download-item-row .btn-row-download {
                            flex: 1 !important;
                            justify-content: center !important;
                            padding: 10px 16px !important;
                            font-size: 14px !important;
                            border-radius: 9999px !important;
                        }
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

// ==========================================================================
// 6. GOOGLE ANTIGRAVITY MULTI-LANGUAGE TRANSLATION & OS SWITCHER ENGINE
// ==========================================================================
const UI_TRANSLATIONS = {
    EN: {
        title: 'Download Social Media Instantly. <span class="gradient">No Ads. No Watermarks.</span>',
        desc: 'From viral reels to high-res photos and crystal-clear audio, VidSavor lets you download unlimited, watermark-free content across all major social networks instantly.',
        placeholder: 'Paste link from Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Paste',
        download: 'Download',
        subtext: 'Paste any public social media link above & it will start fetching automatically!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Free • No Login • 4K HD Quality',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Free',
        stepsBadge: 'Super Simple 3-Step Process',
        stepsTitle: 'Steps to Download Videos & Reels',
        stepsSubhead: "Here's a quick and effortless way to save your favorite media for offline viewing:",
        step1Title: 'Copy Link',
        step1Desc: 'Copy the public link of the video, reel, post, or short from your favorite social platform.',
        step2Title: 'Paste Link',
        step2Desc: 'Paste the copied link into the VidSavor input box above using the one-click Paste button.',
        step3Title: 'Download Media',
        step3Desc: 'Select your preferred video resolution or MP3 format and click download instantly.',
        faqTitle: 'Frequently Asked Questions',
        faqSubhead: 'Everything you need to know about using VidSavor.com',
        dlTitle: 'Download VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'View previous releases',
        dlExtTitle: 'VidSavor Web Extension',
        dlExtBtn: 'Download Extension (.zip)',
        dlAndroidTitle: 'VidSavor Android Share App',
        dlAndroidBtn: 'Download Android APK',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Download iOS Shortcut',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Unduh Aplikasi',
        dlMobileSub: 'Ekstensi, APK Android & iOS',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    HI: {
        title: 'सोशल मीडिया तुरंत डाउनलोड करें। <span class="gradient">कोई विज्ञापन नहीं। कोई वॉटरमार्क नहीं।</span>',
        desc: 'वायरल रील्स से लेकर हाई-रेजोल्यूशन फोटो और क्रिस्टल-क्लियर ऑडियो तक, VidSavor आपको सभी प्रमुख सोशल नेटवर्क से अनलिमिटेड वॉटरमार्क-फ्री कंटेंट तुरंत डाउनलोड करने की सुविधा देता है।',
        placeholder: 'इंस्टाग्राम, टिकटॉक, यूट्यूब, फेसबुक, ट्विटर का लिंक पेस्ट करें...',
        paste: 'पेस्ट करें',
        download: 'डाउनलोड करें',
        subtext: 'ऊपर कोई भी सार्वजनिक सोशल मीडिया लिंक पेस्ट करें और यह अपने आप फ़ेच होना शुरू हो जाएगा!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% मुफ़्त • कोई लॉगिन नहीं • 4K HD क्वालिटी',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% मुफ़्त',
        stepsBadge: 'अति सरल 3-चरणीय प्रक्रिया',
        stepsTitle: 'वीडियो और रील्स डाउनलोड करने के चरण',
        stepsSubhead: 'ऑफ़लाइन देखने के लिए अपने पसंदीदा मीडिया को सहेजने का त्वरित और आसान तरीका:',
        step1Title: 'लिंक कॉपी करें',
        step1Desc: 'अपने पसंदीदा सोशल प्लेटफ़ॉर्म से वीडियो, रील, पोस्ट या शॉर्ट का सार्वजनिक लिंक कॉपी करें।',
        step2Title: 'लिंक पेस्ट करें',
        step2Desc: 'कॉपी किए गए लिंक को एक-क्लिक पेस्ट बटन का उपयोग करके ऊपर VidSavor इनपुट बॉक्स में पेस्ट करें।',
        step3Title: 'मीडिया डाउनलोड करें',
        step3Desc: 'अपनी पसंदीदा वीडियो रिज़ॉल्यूशन या MP3 प्रारूप चुनें और तुरंत डाउनलोड पर क्लिक करें।',
        faqTitle: 'अक्सर पूछे जाने वाले प्रश्न',
        faqSubhead: 'VidSavor.com का उपयोग करने के बारे में आपको जो कुछ जानने की आवश्यकता है',
        dlTitle: 'VidSavor डाउनलोड करें<span class="agy-blinking-cursor"></span>',
        dlReleases: 'पिछली रिलीज़ देखें',
        dlExtTitle: 'VidSavor वेब एक्सटेंशन',
        dlExtBtn: 'एक्सटेंशन डाउनलोड करें (.zip)',
        dlAndroidTitle: 'VidSavor एंड्रॉइड शेयर ऐप',
        dlAndroidBtn: 'एंड्रॉइड APK डाउनलोड करें',
        dlIosTitle: 'VidSavor iOS क्विकशेयर',
        dlIosBtn: 'iOS शॉर्टकट प्राप्त करें',
        dlCliTitle: 'VidSavor CLI और API',
        dlMobileBtn: 'ऐप्स डाउनलोड करें',
        dlMobileSub: 'एक्सटेंशन, एंड्रॉइड APK और iOS'
    },
    ES: {
        title: 'Descarga Redes Sociales al Instante. <span class="gradient">Sin Anuncios. Sin Marca de Agua.</span>',
        desc: 'Desde reels virales hasta fotos de alta resolución y audio nítido, VidSavor te permite descargar contenido ilimitado y sin marcas de agua al instante.',
        placeholder: 'Pega el enlace de Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Pegar',
        download: 'Descargar',
        subtext: '¡Pega cualquier enlace público arriba y comenzará a descargarse automáticamente!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Gratis • Sin Registro • Calidad 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Gratis',
        stepsBadge: 'Proceso Súper Simple de 3 Pasos',
        stepsTitle: 'Pasos para Descargar Videos y Reels',
        stepsSubhead: 'Una forma rápida y sin esfuerzo de guardar tus videos favoritos para ver sin conexión:',
        step1Title: 'Copiar Enlace',
        step1Desc: 'Copia el enlace público del video, reel o short de tu red social favorita.',
        step2Title: 'Pegar Enlace',
        step2Desc: 'Pega el enlace copiado en la barra de búsqueda superior con un solo clic.',
        step3Title: 'Descargar Medio',
        step3Desc: 'Selecciona tu resolución de video o formato MP3 preferido y descarga al instante.',
        faqTitle: 'Preguntas Frecuentes',
        faqSubhead: 'Todo lo que necesitas saber sobre el uso de VidSavor.com',
        dlTitle: 'Descargar VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Ver versiones anteriores',
        dlExtTitle: 'Extensión Web VidSavor',
        dlExtBtn: 'Descargar Extensión (.zip)',
        dlAndroidTitle: 'App VidSavor Android',
        dlAndroidBtn: 'Descargar APK Android',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Descargar Atajo de iOS',
        dlCliTitle: 'VidSavor CLI y API',
        dlMobileBtn: 'Descargar Apps',
        dlMobileSub: 'Extensión, APK Android e iOS'
    },
    ID: {
        title: 'Unduh Media Sosial Seketika. <span class="gradient">Tanpa Iklan. Tanpa Watermark.</span>',
        desc: 'Dari reels viral hingga foto resolusi tinggi dan audio jernih, VidSavor memungkinkan Anda mengunduh konten tanpa batas dan tanpa watermark secara instan.',
        placeholder: 'Tempel tautan dari Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Tempel',
        download: 'Unduh',
        subtext: 'Tempel tautan media sosial publik di atas & pengambilan dimulai otomatis!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Gratis • Tanpa Login • Kualitas 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Gratis',
        stepsBadge: 'Proses 3 Langkah Super Mudah',
        stepsTitle: 'Langkah Mengunduh Video & Reels',
        stepsSubhead: 'Cara cepat dan mudah untuk menyimpan media favorit Anda untuk ditonton offline:',
        step1Title: 'Salin Tautan',
        step1Desc: 'Salin tautan publik video, reel, atau postingan dari platform media sosial favorit Anda.',
        step2Title: 'Tempel Tautan',
        step2Desc: 'Tempel tautan yang disalin ke kotak input VidSavor di atas dengan satu klik.',
        step3Title: 'Unduh Media',
        step3Desc: 'Pilih resolusi video atau format MP3 pilihan Anda dan klik unduh seketika.',
        faqTitle: 'Pertanyaan yang Sering Diajukan',
        faqSubhead: 'Semua yang perlu Anda ketahui tentang menggunakan VidSavor.com',
        dlTitle: 'Unduh VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Lihat rilis sebelumnya',
        dlExtTitle: 'Ekstensi Web VidSavor',
        dlExtBtn: 'Unduh Ekstensi (.zip)',
        dlAndroidTitle: 'Aplikasi Android VidSavor',
        dlAndroidBtn: 'Unduh APK Android',
        dlIosTitle: 'Pintasan Cepat iOS VidSavor',
        dlIosBtn: 'Dapatkan Pintasan iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    DE: {
        title: 'Social Media Sofort Herunterladen. <span class="gradient">Ohne Werbung. Ohne Wasserzeichen.</span>',
        desc: 'Von viralen Reels bis zu hochauflösenden Fotos und kristallklarem Audio – VidSavor ermöglicht den unbegrenzten, wasserzeichenfreien Download.',
        placeholder: 'Link von Instagram, TikTok, YouTube, Facebook, Twitter einfügen...',
        paste: 'Einfügen',
        download: 'Herunterladen',
        subtext: 'Fügen Sie oben einen öffentlichen Link ein – der Download startet automatisch!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Kostenlos • Kein Login • 4K HD Qualität',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Kostenlos',
        stepsBadge: 'Super Einfacher 3-Schritte-Prozess',
        stepsTitle: 'Schritte zum Herunterladen von Videos & Reels',
        stepsSubhead: 'Der mühelose Weg, Ihre Lieblingsmedien für die Offline-Wiedergabe zu speichern:',
        step1Title: 'Link kopieren',
        step1Desc: 'Kopieren Sie den öffentlichen Link des Videos von Ihrer Lieblingsplattform.',
        step2Title: 'Link einfügen',
        step2Desc: 'Fügen Sie den kopierten Link mit der Einfügen-Schaltfläche oben ein.',
        step3Title: 'Medien herunterladen',
        step3Desc: 'Wählen Sie die Videoauflösung oder das MP3-Format und laden Sie es sofort herunter.',
        faqTitle: 'Häufig gestellte Fragen',
        faqSubhead: 'Alles, was Sie über die Nutzung von VidSavor.com wissen müssen',
        dlTitle: 'VidSavor Herunterladen<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Frühere Versionen anzeigen',
        dlExtTitle: 'VidSavor Web-Erweiterung',
        dlExtBtn: 'Erweiterung Herunterladen (.zip)',
        dlAndroidTitle: 'VidSavor Android Share App',
        dlAndroidBtn: 'Android APK Herunterladen',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'iOS Shortcut Herunterladen',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    FR: {
        title: 'Téléchargez les Réseaux Sociaux Instantanément. <span class="gradient">Sans Pub. Sans Filigrane.</span>',
        desc: 'Des reels viraux aux photos haute résolution et audios cristallins, VidSavor vous permet de télécharger du contenu illimité et sans filigrane instantanément.',
        placeholder: 'Collez le lien Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Coller',
        download: 'Télécharger',
        subtext: 'Collez un lien public ci-dessus et la récupération démarre automatiquement!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Gratuit • Sans Connexion • Qualité 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Gratuit',
        stepsBadge: 'Processus Ultra Simple en 3 Étapes',
        stepsTitle: 'Étapes pour Télécharger des Vidéos & Reels',
        stepsSubhead: 'Le moyen le plus rapide d’enregistrer vos vidéos préférées pour un visionnage hors ligne :',
        step1Title: 'Copier le lien',
        step1Desc: 'Copiez le lien public de la vidéo ou du reel depuis votre réseau social préféré.',
        step2Title: 'Coller le lien',
        step2Desc: 'Collez le lien copié dans la barre de recherche VidSavor en un clic.',
        step3Title: 'Télécharger le média',
        step3Desc: 'Sélectionnez votre résolution vidéo ou le format MP3 et téléchargez instantanément.',
        faqTitle: 'Foire Aux Questions',
        faqSubhead: 'Tout ce que vous devez savoir sur l’utilisation de VidSavor.com',
        dlTitle: 'Télécharger VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Voir les versions précédentes',
        dlExtTitle: 'Extension Web VidSavor',
        dlExtBtn: "Télécharger l'Extension (.zip)",
        dlAndroidTitle: 'Application Android VidSavor',
        dlAndroidBtn: "Télécharger l'APK Android",
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Obtenir le Raccourci iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    PT: {
        title: 'Baixe Redes Sociais Instantaneamente. <span class="gradient">Sem Anúncios. Sem Marca d\'Água.</span>',
        desc: 'De reels virais a fotos em alta resolução e áudio cristalino, o VidSavor permite baixar conteúdo ilimitado e sem marca d\'água instantaneamente.',
        placeholder: 'Cole o link do Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Colar',
        download: 'Baixar',
        subtext: 'Cole qualquer link público acima e o download começará automaticamente!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Grátis • Sem Login • Qualidade 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Grátis',
        stepsBadge: 'Processo Super Simples em 3 Passos',
        stepsTitle: 'Passos para Baixar Vídeos & Reels',
        stepsSubhead: 'Uma maneira rápida e fácil de salvar suas mídias favoritas para assistir offline:',
        step1Title: 'Copiar Link',
        step1Desc: 'Copie o link público do vídeo ou reel na sua rede social favorita.',
        step2Title: 'Colar Link',
        step2Desc: 'Cole o link copiado no campo do VidSavor com apenas um clique no botão Colar.',
        step3Title: 'Baixar Mídia',
        step3Desc: 'Escolha a resolução desejada ou formato MP3 e faça o download imediatamente.',
        faqTitle: 'Perguntas Frequentes',
        faqSubhead: 'Tudo o que você precisa saber sobre como usar o VidSavor.com',
        dlTitle: 'Baixar VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Ver versões anteriores',
        dlExtTitle: 'Extensão Web VidSavor',
        dlExtBtn: 'Baixar Extensão (.zip)',
        dlAndroidTitle: 'App Android VidSavor',
        dlAndroidBtn: 'Baixar APK para Android',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Baixar Atalho para iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    TR: {
        title: 'Sosyal Medyayı Anında İndirin. <span class="gradient">Reklamsız. Filigransız.</span>',
        desc: 'Viral videolardan yüksek çözünürlüklü fotoğraflara ve net seslere kadar VidSavor, sınırsız ve filigransız içerik indirmenizi sağlar.',
        placeholder: 'Instagram, TikTok, YouTube, Facebook, Twitter bağlantısını yapıştırın...',
        paste: 'Yapıştır',
        download: 'İndir',
        subtext: 'Yukarıya herkese açık herhangi bir bağlantı yapıştırın, otomatik olarak başlayacaktır!',
        badge: '<i class="fa-solid fa-shield-heart"></i> %100 Ücretsiz • Giriş Yok • 4K HD Kalite',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> %100 Ücretsiz',
        stepsBadge: 'Süper Basit 3 Adımlı Süreç',
        stepsTitle: 'Video ve Reels İndirme Adımları',
        stepsSubhead: 'Çevrimdışı izlemek için favori medyanızı kaydetmenin en hızlı ve kolay yolu:',
        step1Title: 'Bağlantıyı Kopyala',
        step1Desc: 'Favori platformunuzdan videonun veya reels içeriğinin bağlantısını kopyalayın.',
        step2Title: 'Bağlantıyı Yapıştır',
        step2Desc: 'Kopyalanan bağlantıyı yukarıdaki kutuya tek tıkla Yapıştır butonuyla yapıştırın.',
        step3Title: 'Medyayı İndir',
        step3Desc: 'Tercih ettiğiniz video çözünürlüğünü veya MP3 formatını seçin ve anında indirin.',
        faqTitle: 'Sıkça Sorulan Sorular',
        faqSubhead: 'VidSavor.com kullanımı hakkında bilmeniz gereken her şey burada',
        dlTitle: "VidSavor'ı İndir<span class=\"agy-blinking-cursor\"></span>",
        dlReleases: 'Önceki sürümleri görüntüle',
        dlExtTitle: 'VidSavor Web Uzantısı',
        dlExtBtn: 'Uzantıyı İndir (.zip)',
        dlAndroidTitle: 'VidSavor Android Paylaşım Uygulaması',
        dlAndroidBtn: 'Android APK İndir',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'iOS Kestirmesini Al',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    RU: {
        title: 'Скачивайте видео мгновенно. <span class="gradient">Без рекламы. Без водяных знаков.</span>',
        desc: 'От вирусных рилс до фото высокого разрешения и чистого звука — VidSavor позволяет скачивать контент без ограничений и водяных знаков.',
        placeholder: 'Вставьте ссылку из Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Вставить',
        download: 'Скачать',
        subtext: 'Вставьте любую ссылку выше, и загрузка начнется автоматически!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Бесплатно • Без входа • 4K HD качество',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Бесплатно',
        stepsBadge: 'Супер простой процесс в 3 шага',
        stepsTitle: 'Шаги для скачивания видео и рилс',
        stepsSubhead: 'Быстрый способ сохранить любимые медиа для просмотра офлайн:',
        step1Title: 'Скопируйте ссылку',
        step1Desc: 'Скопируйте ссылку на видео или рилс из вашей любимой соцсети.',
        step2Title: 'Вставьте ссылку',
        step2Desc: 'Вставьте ссылку в поле выше с помощью кнопки "Вставить".',
        step3Title: 'Скачайте файл',
        step3Desc: 'Выберите нужное качество видео или MP3 и нажмите "Скачать".',
        faqTitle: 'Часто задаваемые вопросы',
        faqSubhead: 'Все, что вам нужно знать об использовании VidSavor.com',
        dlTitle: 'Скачать VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Посмотреть предыдущие выпуски',
        dlExtTitle: 'Веб-расширение VidSavor',
        dlExtBtn: 'Скачать расширение (.zip)',
        dlAndroidTitle: 'Android-приложение VidSavor',
        dlAndroidBtn: 'Скачать APK для Android',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Получить команду iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    AR: {
        title: 'تحميل من وسائل التواصل فوراً. <span class="gradient">بدون إعلانات. بدون علامة مائية.</span>',
        desc: 'من الريلز الشهيرة إلى الصور عالية الدقة والصوت النقي، يتيح لك VidSavor تنزيل محتوى غير محدود وبدون علامة مائية على الفور.',
        placeholder: 'الصق الرابط من Instagram أو TikTok أو YouTube أو Facebook أو Twitter...',
        paste: 'لصق',
        download: 'تحميل',
        subtext: 'الصق أي رابط عام أعلاه وسيبدأ الجلب تلقائياً!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% مجاني • بدون تسجيل • جودة 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% مجاني',
        stepsBadge: 'عملية سهلة للغاية من 3 خطوات',
        stepsTitle: 'خطوات تحميل الفيديوهات والريلز',
        stepsSubhead: 'طريقة سريعة وبدون مجهود لحفظ مقاطعك المفضلة للمشاهدة بدون إنترنت:',
        step1Title: 'نسخ الرابط',
        step1Desc: 'انسخ الرابط العام للفيديو أو المنشور من منصتك المفضلة.',
        step2Title: 'لصق الرابط',
        step2Desc: 'الصق الرابط المنسوخ في خانة البحث أعلاه بنقرة واحدة.',
        step3Title: 'تحميل الوسائط',
        step3Desc: 'اختر الدقة المناسبة أو صيغة MP3 واضغط على تحميل فوراً.',
        faqTitle: 'الأسئلة الشائعة',
        faqSubhead: 'كل ما تحتاج لمعرفته حول استخدام VidSavor.com',
        dlTitle: 'تحميل VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'عرض الإصدارات السابقة',
        dlExtTitle: 'إضافة متصفح VidSavor',
        dlExtBtn: 'تحميل الإضافة (.zip)',
        dlAndroidTitle: 'تطبيق أندرويد VidSavor',
        dlAndroidBtn: 'تحميل تطبيق أندرويد APK',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'الحصول على اختصار iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    JA: {
        title: 'ソーシャルメディアを瞬時にダウンロード。<span class="gradient">広告なし。透かしなし。</span>',
        desc: '話題のリールから高解像度写真、クリアな音声まで、VidSavorなら透かしなしで無制限に瞬時にダウンロードできます。',
        placeholder: 'Instagram、TikTok、YouTube、Facebook、Twitterのリンクを貼り付け...',
        paste: '貼り付け',
        download: 'ダウンロード',
        subtext: '上に公開リンクを貼り付けると、自動的に取得が開始されます！',
        badge: '<i class="fa-solid fa-shield-heart"></i> 完全無料 • ログイン不要 • 4K HD画質',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 完全無料',
        stepsBadge: '超簡単な3ステップ手順',
        stepsTitle: '動画＆リールのダウンロード手順',
        stepsSubhead: 'お気に入りのメディアをオフライン再生用に保存する最も簡単な方法：',
        step1Title: 'リンクをコピー',
        step1Desc: 'お気に入りのSNSから動画やリールの公開リンクをコピーします。',
        step2Title: 'リンクを貼り付け',
        step2Desc: 'ワンクリックの貼り付けボタンを使って、上の入力欄にリンクを貼り付けます。',
        step3Title: 'メディアをダウンロード',
        step3Desc: '希望の動画解像度またはMP3形式を選択して、すぐにダウンロードします。',
        faqTitle: 'よくある質問',
        faqSubhead: 'VidSavor.comの使い方に関するよくある質問とガイド',
        dlTitle: 'VidSavorをダウンロード<span class="agy-blinking-cursor"></span>',
        dlReleases: '以前のリリースを表示',
        dlExtTitle: 'VidSavor Web拡張機能',
        dlExtBtn: '拡張機能をダウンロード (.zip)',
        dlAndroidTitle: 'VidSavor Android共有アプリ',
        dlAndroidBtn: 'Android APKをダウンロード',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'iOSショートカットを取得',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    KO: {
        title: '소셜 미디어 즉시 다운로드. <span class="gradient">광고 없음. 워터마크 없음.</span>',
        desc: '인기 릴스부터 고해상도 사진 및 선명한 오디오까지, VidSavor는 워터마크 없는 콘텐츠를 무제한으로 다운로드할 수 있게 해줍니다.',
        placeholder: 'Instagram, TikTok, YouTube, Facebook, Twitter 링크를 붙여넣으세요...',
        paste: '붙여넣기',
        download: '다운로드',
        subtext: '위에 공개 링크를 붙여넣으면 자동으로 불러오기가 시작됩니다!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% 무료 • 로그인 불필요 • 4K HD 화질',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% 무료',
        stepsBadge: '매우 간단한 3단계 과정',
        stepsTitle: '비디오 및 릴스 다운로드 방법',
        stepsSubhead: '오프라인 감상을 위해 좋아하는 미디어를 저장하는 가장 빠르고 쉬운 방법:',
        step1Title: '링크 복사',
        step1Desc: '원하는 플랫폼에서 비디오 또는 릴스의 공개 링크를 복사합니다.',
        step2Title: '링크 붙여넣기',
        step2Desc: '한 번의 클릭으로 붙여넣기 버튼을 눌러 위 입력창에 링크를 붙여넣습니다.',
        step3Title: '미디어 다운로드',
        step3Desc: '원하는 비디오 해상도 또는 MP3 형식을 선택하고 즉시 다운로드합니다.',
        faqTitle: '자주 묻는 질문',
        faqSubhead: 'VidSavor.com 이용에 대해 알아야 할 모든 것',
        dlTitle: 'VidSavor 다운로드<span class="agy-blinking-cursor"></span>',
        dlReleases: '이전 릴리스 보기',
        dlExtTitle: 'VidSavor 웹 확장 프로그램',
        dlExtBtn: '확장 프로그램 다운로드 (.zip)',
        dlAndroidTitle: 'VidSavor 안드로이드 공유 앱',
        dlAndroidBtn: 'Android APK 다운로드',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'iOS 단축어 가져오기',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    ZH: {
        title: '即时下载社交媒体视频。<span class="gradient">无广告。无水印。</span>',
        desc: '从热门 Reels 到高清照片和清晰音频，VidSavor 让您即时下载无限制、无水印的优质内容。',
        placeholder: '粘贴来自 Instagram、TikTok、YouTube、Facebook、Twitter 的链接...',
        paste: '粘贴',
        download: '下载',
        subtext: '在上方粘贴任何公开社交媒体链接，即可自动开始解析！',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% 免费 • 无需登录 • 4K 超清画质',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% 免费',
        stepsBadge: '超简单的 3 步操作',
        stepsTitle: '下载视频与 Reels 的步骤',
        stepsSubhead: '轻松几步即可保存您喜爱的视频以供离线观看：',
        step1Title: '复制链接',
        step1Desc: '在您喜爱的社交平台上复制视频或 Reels 的公开链接。',
        step2Title: '粘贴链接',
        step2Desc: '点击“粘贴”按钮将复制的链接填入上方的 VidSavor 输入框。',
        step3Title: '下载媒体',
        step3Desc: '选择您喜欢的高清分辨率或 MP3 格式，即刻点击下载。',
        faqTitle: '常见问题解答',
        faqSubhead: '关于使用 VidSavor.com 的一切解答与指南',
        dlTitle: '下载 VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: '查看以往版本',
        dlExtTitle: 'VidSavor 网页扩展程序',
        dlExtBtn: '下载扩展程序 (.zip)',
        dlAndroidTitle: 'VidSavor 安卓快捷分享 App',
        dlAndroidBtn: '下载 Android APK',
        dlIosTitle: 'VidSavor iOS 快捷指令',
        dlIosBtn: '获取 iOS 快捷指令',
        dlCliTitle: 'VidSavor 命令行工具与 API'
    },
    VI: {
        title: 'Tải Video Mạng Xã Hội Ngay Lập Tức. <span class="gradient">Không Quảng Cáo. Không Logo.</span>',
        desc: 'Từ video reels đến ảnh độ phân giải cao và âm thanh rõ nét, VidSavor giúp bạn tải xuống nội dung không giới hạn và không có watermark.',
        placeholder: 'Dán liên kết từ Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Dán',
        download: 'Tải xuống',
        subtext: 'Dán bất kỳ liên kết công khai nào vào ô trên để tự động tải!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Miễn phí • Không cần đăng nhập • Chất lượng 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Miễn phí',
        stepsBadge: 'Quy trình 3 bước siêu đơn giản',
        stepsTitle: 'Các bước tải video & Reels',
        stepsSubhead: 'Cách nhanh chóng và dễ dàng để lưu video yêu thích của bạn về máy:',
        step1Title: 'Sao chép liên kết',
        step1Desc: 'Sao chép liên kết công khai của video từ mạng xã hội.',
        step2Title: 'Dán liên kết',
        step2Desc: 'Dán liên kết vào ô nhập liệu VidSavor ở trên bằng nút Dán nhanh.',
        step3Title: 'Tải xuống tệp',
        step3Desc: 'Chọn độ phân giải video hoặc định dạng MP3 và bấm tải xuống ngay lập tức.',
        faqTitle: 'Câu hỏi thường gặp',
        faqSubhead: 'Mọi thông tin bạn cần biết về việc sử dụng VidSavor.com',
        dlTitle: 'Tải xuống VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Xem các bản phát hành trước',
        dlExtTitle: 'Tiện ích VidSavor',
        dlExtBtn: 'Tải Tiện ích (.zip)',
        dlAndroidTitle: 'Ứng dụng Android VidSavor',
        dlAndroidBtn: 'Tải APK Android',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Nhận Phím tắt iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    PL: {
        title: 'Pobieraj z mediów społecznościowych. <span class="gradient">Bez reklam. Bez znaku wodnego.</span>',
        desc: 'Od wiralowych rolek po zdjęcia w wysokiej rozdzielczości i krystaliczny dźwięk — VidSavor umożliwia natychmiastowe pobieranie bez limitów.',
        placeholder: 'Wklej link z Instagrama, TikToka, YouTube, Facebooka, Twittera...',
        paste: 'Wklej',
        download: 'Pobierz',
        subtext: 'Wklej dowolny publiczny link powyżej, aby rozpocząć automatyczne pobieranie!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Za darmo • Bez logowania • Jakość 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Za darmo',
        stepsBadge: 'Super prosty proces w 3 krokach',
        stepsTitle: 'Kroki do pobrania filmów i rolek',
        stepsSubhead: 'Szybki i łatwy sposób na zapisanie ulubionych multimediów do oglądania offline:',
        step1Title: 'Skopiuj link',
        step1Desc: 'Skopiuj publiczny link do filmu lub rolki ze swojej ulubionej platformy.',
        step2Title: 'Wklej link',
        step2Desc: 'Wklej skopiowany link do pola wyszukiwania VidSavor za pomocą przycisku Wklej.',
        step3Title: 'Pobierz plik',
        step3Desc: 'Wybierz preferowaną rozdzielczość lub format MP3 i kliknij pobierz.',
        faqTitle: 'Często zadawane pytania',
        faqSubhead: 'Wszystko, co musisz wiedzieć o korzystaniu z VidSavor.com',
        dlTitle: 'Pobierz VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Zobacz poprzednie wydania',
        dlExtTitle: 'Rozszerzenie przeglądarki VidSavor',
        dlExtBtn: 'Pobierz rozszerzenie (.zip)',
        dlAndroidTitle: 'Aplikacja VidSavor na Androida',
        dlAndroidBtn: 'Pobierz APK na Androida',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Pobierz skrót iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    },
    IT: {
        title: 'Scarica da Social Media Istantaneamente. <span class="gradient">Senza Pubblicità. Senza Watermark.</span>',
        desc: 'Dai reel virali alle foto ad alta risoluzione e all’audio cristallino, VidSavor ti consente di scaricare contenuti illimitati e senza watermark.',
        placeholder: 'Incolla il link da Instagram, TikTok, YouTube, Facebook, Twitter...',
        paste: 'Incolla',
        download: 'Scarica',
        subtext: 'Incolla qualsiasi link pubblico qui sopra e l’estrazione inizierà automaticamente!',
        badge: '<i class="fa-solid fa-shield-heart"></i> 100% Gratuito • Nessun Accesso • Qualità 4K HD',
        freeBadge: '<i class="fa-solid fa-circle-check"></i> 100% Gratuito',
        stepsBadge: 'Processo Super Semplice in 3 Passaggi',
        stepsTitle: 'Passaggi per Scaricare Video e Reel',
        stepsSubhead: 'Un modo rapido e semplice per salvare i tuoi video preferiti per la visione offline:',
        step1Title: 'Copia Link',
        step1Desc: 'Copia il link pubblico del video o del reel dalla tua piattaforma preferita.',
        step2Title: 'Incolla Link',
        step2Desc: 'Incolla il link copiato nella casella di input sopra con il pulsante Incolla.',
        step3Title: 'Scarica Media',
        step3Desc: 'Seleziona la tua risoluzione preferita o formato MP3 e scarica immediatamente.',
        faqTitle: 'Domande Frequenti',
        faqSubhead: 'Tutto ciò che devi sapere sull’utilizzo di VidSavor.com',
        dlTitle: 'Scarica VidSavor<span class="agy-blinking-cursor"></span>',
        dlReleases: 'Visualizza versioni precedenti',
        dlExtTitle: 'Estensione Web VidSavor',
        dlExtBtn: 'Scarica Estensione (.zip)',
        dlAndroidTitle: 'App Android VidSavor',
        dlAndroidBtn: 'Scarica APK per Android',
        dlIosTitle: 'VidSavor iOS QuickShare',
        dlIosBtn: 'Ottieni Comando Rapido iOS',
        dlCliTitle: 'VidSavor CLI & API',
        dlMobileBtn: 'Download Apps',
        dlMobileSub: 'Extension, Android APK & iOS'
    }
};

function applyTranslations(code) {
    const raw = (code || 'EN').toUpperCase();
    const baseCode = raw.split('-')[0];
    const t = UI_TRANSLATIONS[raw] || UI_TRANSLATIONS[baseCode] || UI_TRANSLATIONS['EN'];
    if (!t) return;

    // 1. Hero Title & Desc
    const titleEl = document.getElementById('mainTitle');
    if (titleEl && t.title) titleEl.innerHTML = t.title;

    const descEl = document.getElementById('mainDesc');
    if (descEl && t.desc) descEl.textContent = t.desc;

    // 2. Input Box & Buttons
    const urlEl = document.getElementById('videoUrl');
    if (urlEl && t.placeholder) urlEl.placeholder = t.placeholder;

    const pasteBtn = document.querySelector('.paste-btn span');
    if (pasteBtn && t.paste) pasteBtn.textContent = t.paste;

    document.querySelectorAll('.download-btn span, #mainFetchBtn span').forEach(el => {
        if (t.download) el.textContent = t.download;
    });

    const subEl = document.querySelector('.input-subtext');
    if (subEl && t.subtext) subEl.textContent = t.subtext;

    // 3. Badges
    const badgeEl = document.querySelector('.hero .badge');
    if (badgeEl && t.badge) badgeEl.innerHTML = t.badge;

    const freeEl = document.querySelector('.antigravity-badge-free');
    if (freeEl && t.freeBadge) freeEl.innerHTML = t.freeBadge;

    const headerDl = document.querySelector('.header-actions .antigravity-pill-btn span');
    if (headerDl && t.download) headerDl.textContent = t.download;

    const mobDlPrimary = document.querySelector('.mobile-dl-primary-text');
    if (mobDlPrimary && t.dlMobileBtn) mobDlPrimary.textContent = t.dlMobileBtn;
    const mobDlSecondary = document.querySelector('.mobile-dl-secondary-text');
    if (mobDlSecondary && t.dlMobileSub) mobDlSecondary.textContent = t.dlMobileSub;

    // 4. How it works steps
    const stepsBadge = document.querySelector('.steps-container .section-label');
    if (stepsBadge && t.stepsBadge) stepsBadge.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t.stepsBadge}`;

    const stepsTitle = document.querySelector('.steps-container h2');
    if (stepsTitle && t.stepsTitle) stepsTitle.textContent = t.stepsTitle;

    const stepsSub = document.querySelector('.steps-container .section-subhead');
    if (stepsSub && t.stepsSubhead) stepsSub.textContent = t.stepsSubhead;

    const stepCards = document.querySelectorAll('.steps-grid .step-card');
    if (stepCards.length >= 3) {
        if (t.step1Title) {
            const h3 = stepCards[0].querySelector('h3');
            if (h3) h3.textContent = t.step1Title;
        }
        if (t.step1Desc) {
            const p = stepCards[0].querySelector('p');
            if (p) p.textContent = t.step1Desc;
        }
        if (t.step2Title) {
            const h3 = stepCards[1].querySelector('h3');
            if (h3) h3.textContent = t.step2Title;
        }
        if (t.step2Desc) {
            const p = stepCards[1].querySelector('p');
            if (p) p.textContent = t.step2Desc;
        }
        if (t.step3Title) {
            const h3 = stepCards[2].querySelector('h3');
            if (h3) h3.textContent = t.step3Title;
        }
        if (t.step3Desc) {
            const p = stepCards[2].querySelector('p');
            if (p) p.textContent = t.step3Desc;
        }
    }

    // 5. FAQ Header
    const faqTitle = document.querySelector('.faq-header-custom h2');
    if (faqTitle && t.faqTitle) faqTitle.textContent = t.faqTitle;

    const faqSub = document.querySelector('.faq-header-custom .section-subhead');
    if (faqSub && t.faqSubhead) faqSub.textContent = t.faqSubhead;

    // 6. Download Page Elements
    const agyTitle = document.querySelector('.agy-dl-title');
    if (agyTitle && t.dlTitle) agyTitle.innerHTML = t.dlTitle;

    const agyRel = document.querySelector('.agy-btn-releases span');
    if (agyRel && t.dlReleases) agyRel.textContent = t.dlReleases;

    const extTitle = document.querySelector('#sec-extension .agy-section-title');
    if (extTitle && t.dlExtTitle) extTitle.textContent = t.dlExtTitle;
    const btnExt = document.querySelector('#btnDlExtension span');
    if (btnExt && t.dlExtBtn) btnExt.textContent = t.dlExtBtn;

    const andTitle = document.querySelector('#sec-android .agy-section-title');
    if (andTitle && t.dlAndroidTitle) andTitle.textContent = t.dlAndroidTitle;
    const btnAnd = document.querySelector('#btnDlAndroid span');
    if (btnAnd && t.dlAndroidBtn) btnAnd.textContent = t.dlAndroidBtn;

    const iosTitle = document.querySelector('#sec-ios .agy-section-title');
    if (iosTitle && t.dlIosTitle) iosTitle.textContent = t.dlIosTitle;
    const btnIos = document.querySelector('#btnDlIos span');
    if (btnIos && t.dlIosBtn) btnIos.textContent = t.dlIosBtn;

    const cliTitle = document.querySelector('#sec-cli .agy-section-title');
    if (cliTitle && t.dlCliTitle) cliTitle.textContent = t.dlCliTitle;
}

function applyGoogleTranslate(code) {
    let raw = (code || 'EN').toUpperCase();
    let lang = raw.toLowerCase().split('-')[0];
    if (raw === 'ZH') lang = 'zh-CN';

    // Set or clear cookie
    if (lang === 'en') {
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        try {
            document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
            document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + window.location.hostname.replace(/^www\./, '');
        } catch (e) {}
    } else {
        document.cookie = 'googtrans=/en/' + lang + '; path=/;';
        try {
            document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=' + window.location.hostname;
            document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + window.location.hostname.replace(/^www\./, '');
        } catch (e) {}
    }

    // Trigger existing combo if loaded
    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
    } else if (lang !== 'en') {
        // Dynamically inject Google Website Translator
        if (!document.getElementById('google-translate-script')) {
            const container = document.createElement('div');
            container.id = 'google_translate_element';
            container.style.display = 'none';
            document.body.appendChild(container);

            window.googleTranslateElementInit = function() {
                try {
                    new google.translate.TranslateElement({
                        pageLanguage: 'en',
                        autoDisplay: false
                    }, 'google_translate_element');
                    setTimeout(() => {
                        const c = document.querySelector('.goog-te-combo');
                        if (c) {
                            c.value = lang;
                            c.dispatchEvent(new Event('change'));
                        }
                    }, 400);
                } catch (err) {}
            };

            const s = document.createElement('script');
            s.id = 'google-translate-script';
            s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
            document.body.appendChild(s);
        }
    }
}

function initLanguageSelector() {
    const btn = document.getElementById('langSelectorBtn');
    const menu = document.getElementById('langDropdownMenu');
    if (!btn || !menu) return;

    // Load saved language or default to EN
    const savedCode = localStorage.getItem('vidsavor_lang') || 'EN';
    updateLanguageUI(savedCode);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.classList.remove('show');
        }
    });

    menu.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.preventDefault();
            const code = opt.getAttribute('data-code') || 'EN';
            localStorage.setItem('vidsavor_lang', code);
            updateLanguageUI(code);
            menu.classList.remove('show');
        });
    });
}

function updateLanguageUI(code) {
    const raw = (code || 'EN').toUpperCase();
    const btnText = document.getElementById('currentLangCode');
    if (btnText) btnText.textContent = raw;

    const menu = document.getElementById('langDropdownMenu');
    if (menu) {
        menu.querySelectorAll('.lang-option').forEach(opt => {
            const itemCode = opt.getAttribute('data-code');
            if (itemCode === raw) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    // 1. Instant client-side DOM translation
    applyTranslations(raw);

    // 2. Full-page Google Translate translation
    applyGoogleTranslate(raw);
}

// OS Switcher for Download Page (Exact Google Antigravity behavior)
function switchAgyOsTab(targetOs) {
    document.querySelectorAll('.agy-os-pill').forEach(pill => {
        pill.classList.toggle('active', pill.getAttribute('data-os') === targetOs);
    });

    const extSec = document.getElementById('sec-extension');
    const androidSec = document.getElementById('sec-android');
    const iosSec = document.getElementById('sec-ios');
    const cliSec = document.getElementById('sec-cli');
    const container = document.getElementById('agySectionsContainer');
    if (!container) return;

    if (targetOs === 'android') {
        if (androidSec) container.prepend(androidSec);
    } else if (targetOs === 'ios') {
        if (iosSec) container.prepend(iosSec);
    } else if (targetOs === 'linux') {
        if (cliSec) container.prepend(cliSec);
    } else {
        if (extSec) container.prepend(extSec);
    }
}

window.switchAgyOsTab = switchAgyOsTab;
window.initLanguageSelector = initLanguageSelector;
window.updateLanguageUI = updateLanguageUI;
window.applyTranslations = applyTranslations;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initLanguageSelector();
});
