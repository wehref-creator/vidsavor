/**
 * VidSavor Creator Hub - Audio & Media Engine
 * Powers /sound-effects, /meme-sounds, and /meme-clips
 * Provides instant 0-lag Web Audio synthesis, interactive soundboard, waveform visuals & direct downloads.
 */

(function() {
    'use strict';

    let audioCtx = null;
    let activeSource = null;
    let currentlyPlayingId = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // =========================================================================
    // 1. HIGH-PRECISION WEB AUDIO SOUND SYNTHESIS ENGINES
    // =========================================================================
    const SoundSynthesizers = {
        whoosh_fast: (ctx) => {
            const duration = 0.45;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.sin((t / duration) * Math.PI);
                    const noise = (Math.random() * 2 - 1) * Math.pow(env, 2);
                    data[i] = noise * 0.85;
                }
            }
            return buffer;
        },

        whoosh_cinematic: (ctx) => {
            const duration = 1.2;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.sin((t / duration) * Math.PI);
                    const sub = Math.sin(2 * Math.PI * (80 + 300 * env) * t) * 0.4 * env;
                    const noise = (Math.random() * 2 - 1) * Math.pow(env, 1.8) * 0.6;
                    data[i] = (sub + noise) * 0.9;
                }
            }
            return buffer;
        },

        whip_whoosh: (ctx) => {
            const duration = 0.3;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.pow(Math.sin((t / duration) * Math.PI), 4);
                    const freq = 400 + 1200 * (1 - t / duration);
                    const sweep = Math.sin(2 * Math.PI * freq * t) * 0.3;
                    const noise = (Math.random() * 2 - 1) * 0.7;
                    data[i] = (sweep + noise) * env;
                }
            }
            return buffer;
        },

        bubble_pop: (ctx) => {
            const duration = 0.15;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 30);
                    const freq = 800 * Math.exp(-t * 20) + 300;
                    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
                }
            }
            return buffer;
        },

        mouse_click: (ctx) => {
            const duration = 0.08;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const click1 = (t < 0.015) ? (Math.random() * 2 - 1) * Math.exp(-t * 400) : 0;
                    const click2 = (t > 0.02 && t < 0.05) ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.02) * 300) * 0.7 : 0;
                    data[i] = (click1 + click2) * 0.9;
                }
            }
            return buffer;
        },

        camera_shutter: (ctx) => {
            const duration = 0.4;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const snap1 = (t < 0.08) ? (Math.random() * 2 - 1) * Math.exp(-t * 80) : 0;
                    const motor = (t > 0.09 && t < 0.28) ? Math.sin(2 * Math.PI * 450 * t) * 0.2 * (Math.random() * 0.5 + 0.5) : 0;
                    const snap2 = (t > 0.28 && t < 0.38) ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.28) * 90) * 0.8 : 0;
                    data[i] = (snap1 + motor + snap2) * 0.85;
                }
            }
            return buffer;
        },

        notification_ding: (ctx) => {
            const duration = 1.2;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 4);
                    const note1 = Math.sin(2 * Math.PI * 1318.51 * t) * 0.5; // E6
                    const note2 = Math.sin(2 * Math.PI * 2093.00 * t) * 0.3; // C7
                    data[i] = (note1 + note2) * env;
                }
            }
            return buffer;
        },

        keyboard_typing: (ctx) => {
            const duration = 0.6;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            const clickTimes = [0.02, 0.12, 0.22, 0.31, 0.45];
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    let val = 0;
                    clickTimes.forEach(ct => {
                        if (t >= ct && t < ct + 0.03) {
                            const dt = t - ct;
                            val += (Math.random() * 2 - 1) * Math.exp(-dt * 300) * 0.6;
                        }
                    });
                    data[i] = val;
                }
            }
            return buffer;
        },

        sub_bass_drop: (ctx) => {
            const duration = 1.8;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 1.8);
                    const freq = 140 * Math.exp(-t * 3.5) + 38;
                    const sine = Math.sin(2 * Math.PI * freq * t);
                    // Gentle soft-clip saturation for heavy punch
                    data[i] = Math.tanh(sine * 1.5) * env * 0.95;
                }
            }
            return buffer;
        },

        cinematic_riser: (ctx) => {
            const duration = 3.2;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const progress = t / duration;
                    const env = Math.pow(progress, 2.2);
                    const freq = 60 + 750 * Math.pow(progress, 3);
                    const tone = Math.sin(2 * Math.PI * freq * t) * 0.5;
                    const noise = (Math.random() * 2 - 1) * 0.5 * Math.pow(progress, 2);
                    data[i] = (tone + noise) * env;
                }
            }
            return buffer;
        },

        glitch_impact: (ctx) => {
            const duration = 0.7;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 5);
                    const stutter = Math.floor(t * 40) % 2 === 0 ? 1 : -0.5;
                    const noise = (Math.random() * 2 - 1) * 0.6;
                    const tone = Math.sin(2 * Math.PI * 180 * t) * 0.4;
                    data[i] = (noise * stutter + tone) * env;
                }
            }
            return buffer;
        },

        cartoon_boing: (ctx) => {
            const duration = 1.0;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 2.8);
                    const baseFreq = 220 + 350 * (t / duration);
                    const lfo = Math.sin(2 * Math.PI * 14 * t) * 45;
                    data[i] = Math.sin(2 * Math.PI * (baseFreq + lfo) * t) * env * 0.85;
                }
            }
            return buffer;
        },

        sad_trombone: (ctx) => {
            const duration = 2.4;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            const notes = [233.08, 220.00, 207.65, 196.00]; // Bb3, A3, Ab3, G3
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const noteIdx = Math.min(3, Math.floor(t / 0.55));
                    const noteTime = t % 0.55;
                    let freq = notes[noteIdx];
                    if (noteIdx === 3) {
                        freq -= noteTime * 40; // Glissando slide down
                    }
                    const env = Math.exp(-noteTime * 2.5);
                    // Add brass odd harmonics
                    const fundamental = Math.sin(2 * Math.PI * freq * t);
                    const h3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.35;
                    data[i] = (fundamental + h3) * env * 0.75;
                }
            }
            return buffer;
        },

        coin_collect: (ctx) => {
            const duration = 0.5;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const freq = (t < 0.1) ? 987.77 : 1318.51; // B5 to E6
                    const env = (t < 0.1) ? 1.0 : Math.exp(-(t - 0.1) * 9);
                    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
                }
            }
            return buffer;
        },

        vine_boom: (ctx) => {
            const duration = 1.6;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 2.2);
                    const subFreq = 58 * Math.exp(-t * 2.5) + 32;
                    const sub = Math.sin(2 * Math.PI * subFreq * t);
                    const crunch = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.8;
                    const boom = Math.tanh((sub * 2.2) + crunch) * env;
                    data[i] = boom * 0.95;
                }
            }
            return buffer;
        },

        bruh_sound: (ctx) => {
            const duration = 0.7;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.sin((t / duration) * Math.PI) * Math.exp(-t * 2.5);
                    const f0 = 110 - 25 * (t / duration); // Pitch drop
                    // Formants for /uh/ vowel sound (F1=600Hz, F2=1040Hz)
                    const formant1 = Math.sin(2 * Math.PI * 600 * t) * 0.5;
                    const formant2 = Math.sin(2 * Math.PI * 1040 * t) * 0.3;
                    const voice = Math.sin(2 * Math.PI * f0 * t);
                    data[i] = voice * (formant1 + formant2 + 0.3) * env * 1.2;
                }
            }
            return buffer;
        },

        metal_pipe: (ctx) => {
            const duration = 2.2;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            // Non-harmonic resonant modes of a hollow cylinder
            const freqs = [380, 890, 1420, 2180, 3100, 4350];
            const amps = [0.3, 0.25, 0.2, 0.15, 0.1, 0.08];
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 2.8);
                    let val = 0;
                    for (let m = 0; m < freqs.length; m++) {
                        val += Math.sin(2 * Math.PI * freqs[m] * t) * amps[m];
                    }
                    const hit = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.5;
                    data[i] = (val + hit) * env * 0.9;
                }
            }
            return buffer;
        },

        mlg_airhorn: (ctx) => {
            const duration = 0.8;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            // Classic triple blast airhorn pitch pattern (approx F#5)
            const freq = 740;
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const gate = (t < 0.18 || (t > 0.24 && t < 0.42) || (t > 0.48 && t < 0.75)) ? 1 : 0;
                    const square = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.6 : -0.6;
                    const sub = Math.sin(2 * Math.PI * (freq / 2) * t) * 0.3;
                    data[i] = (square + sub) * gate * 0.8;
                }
            }
            return buffer;
        },

        sad_violin: (ctx) => {
            const duration = 3.5;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            // Emotional sorrow melody: D4 -> F4 -> E4 -> D4
            const melody = [293.66, 349.23, 329.63, 293.66];
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const mIdx = Math.min(3, Math.floor((t / duration) * 4));
                    const freq = melody[mIdx];
                    const vibrato = Math.sin(2 * Math.PI * 5.5 * t) * 4.5;
                    const env = Math.sin((t / duration) * Math.PI);
                    const sawtooth = 2 * ((t * (freq + vibrato)) % 1) - 1;
                    data[i] = sawtooth * env * 0.45;
                }
            }
            return buffer;
        },

        emotional_damage: (ctx) => {
            // High impact meme punch with reverberated vocal tail
            const duration = 1.4;
            const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const t = i / ctx.sampleRate;
                    const env = Math.exp(-t * 2.5);
                    const slap = (Math.random() * 2 - 1) * Math.exp(-t * 25) * 0.7;
                    const pitch = 220 * Math.exp(-t * 3) + 70;
                    const body = Math.sin(2 * Math.PI * pitch * t) * 0.5;
                    data[i] = (slap + body) * env;
                }
            }
            return buffer;
        }
    };

    // =========================================================================
    // 2. AUDIO PLAYBACK & STATE MANAGEMENT
    // =========================================================================
    function playSound(synthKey, elementId) {
        const ctx = getAudioContext();
        if (activeSource) {
            try { activeSource.stop(); } catch(e) {}
            activeSource = null;
        }

        // Reset previous playing buttons
        document.querySelectorAll('.sound-play-btn.playing, .soundboard-btn.active').forEach(b => {
            b.classList.remove('playing', 'active');
            const icon = b.querySelector('i');
            if (icon && icon.classList.contains('fa-pause')) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
        });

        const synthFn = SoundSynthesizers[synthKey] || SoundSynthesizers.whoosh_fast;
        const buffer = synthFn(ctx);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        activeSource = source;
        currentlyPlayingId = elementId;

        const targetEl = document.getElementById(elementId);
        if (targetEl) {
            targetEl.classList.add('playing', 'active');
            const icon = targetEl.querySelector('i');
            if (icon && icon.classList.contains('fa-play')) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            }
        }

        source.onended = () => {
            if (targetEl) {
                targetEl.classList.remove('playing', 'active');
                const icon = targetEl.querySelector('i');
                if (icon && icon.classList.contains('fa-pause')) {
                    icon.classList.remove('fa-pause');
                    icon.classList.add('fa-play');
                }
            }
            activeSource = null;
            currentlyPlayingId = null;
        };
    }

    function stopAllAudio() {
        if (activeSource) {
            try { activeSource.stop(); } catch(e) {}
            activeSource = null;
        }
        document.querySelectorAll('.sound-play-btn.playing, .soundboard-btn.active').forEach(b => {
            b.classList.remove('playing', 'active');
            const icon = b.querySelector('i');
            if (icon && icon.classList.contains('fa-pause')) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
        });
    }

    // =========================================================================
    // 3. 16-BIT 44.1KHZ PCM WAV ENCODER & DOWNLOAD ENGINE
    // =========================================================================
    function bufferToWave(abuffer) {
        const numOfChan = abuffer.numberOfChannels;
        const length = abuffer.length * numOfChan * 2 + 44;
        const out = new DataView(new ArrayBuffer(length));
        let channels = [], sampleRate = abuffer.sampleRate, offset = 0, pos = 0;

        function setUint16(data) {
            out.setUint16(pos, data, true);
            pos += 2;
        }
        function setUint32(data) {
            out.setUint32(pos, data, true);
            pos += 4;
        }

        // write WAVE header
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8);  // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16);         // length = 16
        setUint16(1);          // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(sampleRate);
        setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);              // block-align
        setUint16(16);                         // 16-bit

        setUint32(0x61746164); // "data" chunk
        setUint32(length - pos - 4); // chunk length

        for (let i = 0; i < abuffer.numberOfChannels; i++) {
            channels.push(abuffer.getChannelData(i));
        }

        while (offset < abuffer.length) {
            for (let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
                out.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        return new Blob([out.buffer], { type: 'audio/wav' });
    }

    function downloadSound(synthKey, soundTitle) {
        const ctx = getAudioContext();
        const synthFn = SoundSynthesizers[synthKey] || SoundSynthesizers.whoosh_fast;
        const buffer = synthFn(ctx);
        const blob = bufferToWave(buffer);

        // Sanitize filename and format with first words + vidsavor.com
        const cleanTitle = (soundTitle || 'sound_effect')
            .replace(/[^\w\s-]/g, '')
            .trim()
            .split(/\s+/)
            .slice(0, 7)
            .join('_');

        const fileName = `${cleanTitle}_vidsavor.com.wav`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // =========================================================================
    // 4. CLIENT-SIDE LIVE SEARCH & CATEGORY FILTERING
    // =========================================================================
    function filterCards(query, category) {
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

        const countEl = document.getElementById('resultsCount');
        if (countEl) {
            countEl.textContent = `${visibleCount} items found`;
        }
    }

    // Setup Category Tabs
    function initCategoryTabs() {
        const tabBtns = document.querySelectorAll('.category-pill');
        const searchInput = document.getElementById('hubSearchInput');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cat = btn.getAttribute('data-cat') || 'all';
                filterCards(searchInput ? searchInput.value : '', cat);
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const activeTab = document.querySelector('.category-pill.active');
                const cat = activeTab ? activeTab.getAttribute('data-cat') : 'all';
                filterCards(e.target.value, cat);
            });
        }
    }

    // =========================================================================
    // 5. VIDEO MEME CLIP PREVIEWS & DOWNLOADS
    // =========================================================================
    function initVideoClipCards() {
        const clipCards = document.querySelectorAll('.clip-card');
        clipCards.forEach(card => {
            const video = card.querySelector('video');
            if (!video) return;

            card.addEventListener('mouseenter', () => {
                video.play().catch(() => {});
            });
            card.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        });
    }

    // Expose global methods
    window.VidSavorHub = {
        playSound: playSound,
        stopAllAudio: stopAllAudio,
        downloadSound: downloadSound,
        filterCards: filterCards,
        initCategoryTabs: initCategoryTabs,
        initVideoClipCards: initVideoClipCards
    };

    document.addEventListener('DOMContentLoaded', () => {
        initCategoryTabs();
        initVideoClipCards();
    });

})();
