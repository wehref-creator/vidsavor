/**
 * VidSavor Creator Hub - Audio & Media Engine
 * Powers /sound-effects, /meme-sounds, and /meme-clips
 * Provides instant authentic audio playback, soundboard animations, video clip hover previews,
 * and 1-click downloads with exact title formatting (<first 7 words>_vidsavor.com.<ext>).
 */

(function() {
    'use strict';

    let currentAudio = null;
    let currentlyPlayingId = null;
    let activeCardElement = null;

    // Helper: format clean 7-word download filename
    function formatFilename(title, ext) {
        if (!title) return `vidsavor_media.${ext}`;
        // Clean special characters
        const clean = title.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
        const words = clean.split(/\s+/).filter(Boolean);
        const first7 = words.slice(0, 7).join('_');
        return `${first7 || 'vidsavor'}_vidsavor.com.${ext}`;
    }

    // =========================================================================
    // 1. REAL AUDIO PLAYBACK ENGINE (MEME SOUNDS & SOUND EFFECTS)
    // =========================================================================
    function playSound(soundId, audioSrc) {
        if (!soundId) return;

        // If clicking the currently playing sound, toggle pause
        if (currentlyPlayingId === soundId && currentAudio && !currentAudio.paused) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            resetPlayingState();
            return;
        }

        // Stop any previous playing sound
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            resetPlayingState();
        }

        // Determine audio source URL
        let src = audioSrc;
        if (!src) {
            // Check if card has data-src
            const card = document.querySelector(`[data-sound-id="${soundId}"]`);
            if (card && card.getAttribute('data-src')) {
                src = card.getAttribute('data-src');
            } else {
                src = `/static/audio/memes/${soundId}.mp3`;
            }
        }

        // Create new Audio instance
        const audio = new Audio(src);
        currentAudio = audio;
        currentlyPlayingId = soundId;

        // Find associated trigger elements
        const triggerBtn = document.querySelector(`[onclick*="playSound('${soundId}'"]`) ||
                           document.querySelector(`[data-sound-id="${soundId}"] button`);
        const card = document.querySelector(`[data-sound-id="${soundId}"]`) ||
                     (triggerBtn ? triggerBtn.closest('.sound-card, .soundboard-card') : null);

        activeCardElement = card;

        if (triggerBtn) {
            triggerBtn.classList.add('active');
            const icon = triggerBtn.querySelector('i');
            if (icon && icon.classList.contains('fa-play')) {
                icon.className = 'fa-solid fa-pause';
            }
        }
        if (card) {
            card.classList.add('playing');
        }

        audio.play().catch(err => {
            console.warn(`Audio playback failed for ${soundId}:`, err);
            resetPlayingState();
        });

        audio.onended = () => {
            resetPlayingState();
        };

        audio.onerror = () => {
            console.warn(`Error loading audio stream: ${src}`);
            resetPlayingState();
        };
    }

    function resetPlayingState() {
        if (currentlyPlayingId) {
            const triggerBtn = document.querySelector(`[onclick*="playSound('${currentlyPlayingId}'"]`) ||
                               document.querySelector(`[data-sound-id="${currentlyPlayingId}"] button`);
            if (triggerBtn) {
                triggerBtn.classList.remove('active');
                const icon = triggerBtn.querySelector('i');
                if (icon && icon.classList.contains('fa-pause')) {
                    icon.className = 'fa-solid fa-play';
                }
            }
            if (activeCardElement) {
                activeCardElement.classList.remove('playing');
            }
            currentlyPlayingId = null;
            activeCardElement = null;
        }
    }

    // =========================================================================
    // 2. 1-CLICK AUDIO DOWNLOAD (MP3)
    // =========================================================================
    function downloadAudio(title, audioSrc) {
        const filename = formatFilename(title, 'mp3');
        const downloadUrl = `/api/proxy-download?url=${encodeURIComponent(audioSrc)}&filename=${encodeURIComponent(filename)}`;

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // =========================================================================
    // 3. 1-CLICK MEME VIDEO CLIP DOWNLOAD (MP4)
    // =========================================================================
    function downloadMemeVideo(title, videoUrl) {
        const filename = formatFilename(title, 'mp4');
        const downloadUrl = `/api/proxy-download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // =========================================================================
    // 4. REAL VIDEO PREVIEWS ON HOVER & TAP
    // =========================================================================
    function initVideoClipCards() {
        const clipCards = document.querySelectorAll('.clip-card');
        clipCards.forEach(card => {
            const video = card.querySelector('video');
            if (!video) return;

            // Desktop hover preview
            card.addEventListener('mouseenter', () => {
                video.muted = true;
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {});
                }
            });

            card.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });

            // Mobile tap or click to preview
            card.querySelector('.clip-thumb-wrap')?.addEventListener('click', (e) => {
                // If clicking download button, don't toggle video
                if (e.target.closest('button')) return;
                if (video.paused) {
                    video.muted = false;
                    video.play().catch(() => {
                        video.muted = true;
                        video.play().catch(() => {});
                    });
                } else {
                    video.pause();
                }
            });
        });
    }

    // =========================================================================
    // 5. SEARCH & CATEGORY FILTERING ENGINE
    // =========================================================================
    function filterCards(category, query) {
        const q = (query || '').toLowerCase().trim();
        const cat = (category || 'all').toLowerCase();

        const cards = document.querySelectorAll('.sound-card, .soundboard-card, .clip-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
            const cardTitle = (card.getAttribute('data-title') || '').toLowerCase();
            const cardTags = (card.getAttribute('data-tags') || '').toLowerCase();

            const matchesCategory = (cat === 'all' || cardCat.includes(cat));
            const matchesQuery = (!q || cardTitle.includes(q) || cardTags.includes(q));

            if (matchesCategory && matchesQuery) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        const countBadge = document.getElementById('resultsCount');
        if (countBadge) {
            const itemType = document.querySelector('.clips-grid') ? 'Meme Video Clips' :
                             document.querySelector('.soundboard-grid') ? 'Meme Sounds' : 'Sound Effects';
            countBadge.textContent = `${visibleCount} ${itemType} Available`;
        }
    }

    function initCategoryTabs() {
        const tabs = document.querySelectorAll('.category-pill');
        const searchInput = document.getElementById('hubSearchInput');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const cat = tab.getAttribute('data-cat') || 'all';
                filterCards(cat, searchInput ? searchInput.value : '');
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const activeTab = document.querySelector('.category-pill.active');
                const cat = activeTab ? activeTab.getAttribute('data-cat') : 'all';
                filterCards(cat, e.target.value);
            });
        }
    }

    // Export globally for inline onclick handlers
    window.VidSavorHub = {
        playSound: playSound,
        downloadAudio: downloadAudio,
        downloadMemeVideo: downloadMemeVideo,
        filterCards: filterCards
    };

    window.playSound = playSound;
    window.downloadAudio = downloadAudio;
    window.downloadMemeVideo = downloadMemeVideo;

    document.addEventListener('DOMContentLoaded', () => {
        initCategoryTabs();
        initVideoClipCards();
    });

})();
