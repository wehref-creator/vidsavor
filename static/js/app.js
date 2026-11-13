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

// Instant Direct Download Engine (No new tabs, no page redirection, SaveFrom UX)
async function triggerInstantDownload(streamUrl, filename, btnElement) {
    if (!streamUrl) {
        alert('Download stream URL not found.');
        return;
    }

    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';
    btnElement.disabled = true;

    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(streamUrl)}&filename=${encodeURIComponent(filename)}`;

    // STRATEGY 1: Fetch through proxy with streaming blob (Prevents any page redirection, saves directly to disk)
    try {
        const response = await fetch(proxyUrl);
        const contentType = response.headers.get('content-type') || '';
        
        // Ensure the response is valid binary media, NOT an error or HTML page!
        if (response.ok && !contentType.includes('text/html') && !contentType.includes('application/json')) {
            const blob = await response.blob();
            if (blob.size > 2048) { // Valid binary media
                const blobUrl = window.URL.createObjectURL(blob);
                const tempLink = document.createElement('a');
                tempLink.style.display = 'none';
                tempLink.href = blobUrl;
                tempLink.download = filename;
                document.body.appendChild(tempLink);
                tempLink.click();
                
                setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl);
                    tempLink.remove();
                }, 1000);

                btnElement.innerHTML = '<i class="fa-solid fa-check"></i> <span>Done!</span>';
                setTimeout(() => {
                    btnElement.innerHTML = originalHTML;
                    btnElement.disabled = false;
                }, 3000);
                return;
            }
        }
    } catch (fetchErr) {
        console.warn("Proxy blob fetch failed, checking alternatives:", fetchErr);
    }

    // STRATEGY 2: Direct CORS fetch from CDN (if supported by origin CDN)
    try {
        const directRes = await fetch(streamUrl, { mode: 'cors' });
        if (directRes.ok) {
            const blob = await directRes.blob();
            if (blob.size > 2048) {
                const blobUrl = window.URL.createObjectURL(blob);
                const tempLink = document.createElement('a');
                tempLink.style.display = 'none';
                tempLink.href = blobUrl;
                tempLink.download = filename;
                document.body.appendChild(tempLink);
                tempLink.click();

                setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl);
                    tempLink.remove();
                }, 1000);

                btnElement.innerHTML = '<i class="fa-solid fa-check"></i> <span>Done!</span>';
                setTimeout(() => {
                    btnElement.innerHTML = originalHTML;
                    btnElement.disabled = false;
                }, 3000);
                return;
            }
        }
    } catch (corsErr) {
        console.warn("Direct CORS stream not allowed by CDN:", corsErr);
    }

    // STRATEGY 3: Hidden iframe background trigger targeting proxy endpoint
    // Browser receives Content-Disposition: attachment header and downloads without page redirection
    const hiddenIframe = document.createElement('iframe');
    hiddenIframe.style.display = 'none';
    hiddenIframe.src = proxyUrl;
    document.body.appendChild(hiddenIframe);

    setTimeout(() => {
        hiddenIframe.remove();
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> <span>Started!</span>';
        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
            btnElement.disabled = false;
        }, 2500);
    }, 2000);
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

            // Render SaveFrom-Style Download Rows (Right on the page, NO redirection)
            if (container) {
                container.innerHTML = '';

                // Handle single stream download
                if (data.download && (!data.results || data.results.length === 0)) {
                    const singleRow = document.createElement('div');
                    singleRow.className = 'download-item-row primary-row';
                    const safeTitle = (currentTitle || 'vidsavor').slice(0, 45).replace(/[^a-zA-Z0-9_-]/g, '_');
                    const cleanName = `${safeTitle}.mp4`;
                    singleRow.innerHTML = `
                        <div class="row-left">
                            <div class="row-icon"><i class="fa-solid fa-video"></i></div>
                            <div class="row-info">
                                <span class="row-title">Full HD Video (MP4)</span>
                                <span class="row-sub">Instant Watermark-Free Direct Save</span>
                            </div>
                        </div>
                        <div class="row-right">
                            <span class="row-size-pill">Original HD</span>
                            <button class="btn-row-download" type="button">
                                <i class="fa-solid fa-download"></i> <span>Download</span>
                            </button>
                        </div>
                    `;
                    const singleDownloadBtn = singleRow.querySelector('.btn-row-download');
                    singleRow.addEventListener('click', (e) => {
                        e.preventDefault();
                        triggerInstantDownload(data.download, cleanName, singleDownloadBtn);
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

                        let iconClass = 'fa-solid fa-video';
                        if (isAudio) iconClass = 'fa-solid fa-music';
                        if (isPhoto) iconClass = 'fa-regular fa-image';

                        rowEl.className = `download-item-row ${isPrimary ? 'primary-row' : ''}`;
                        rowEl.innerHTML = `
                            <div class="row-left">
                                <div class="row-icon">
                                    <i class="${iconClass}"></i>
                                </div>
                                <div class="row-info">
                                    <span class="row-title">${cleanQ} (${ext.toUpperCase()})</span>
                                    <span class="row-sub">Watermark-Free Direct Save</span>
                                </div>
                            </div>
                            <div class="row-right">
                                <span class="row-size-pill">${item.size || 'HD File'}</span>
                                <button class="btn-row-download" type="button">
                                    <i class="fa-solid fa-download"></i> <span>Download</span>
                                </button>
                            </div>
                        `;

                        const downloadBtn = rowEl.querySelector('.btn-row-download');
                        rowEl.addEventListener('click', (e) => {
                            e.preventDefault();
                            triggerInstantDownload(item.url, cleanFilename, downloadBtn);
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
