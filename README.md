# 🌟 VidSavor.com - Fast & HD Online Video Downloader

VidSavor is an ultra-fast, multi-platform media extraction web application inspired by **FreeVideoSave.com** with enhanced modern design, glassmorphic UI, responsive layouts, and robust backend streaming pipelines.

---

## ⚡ Features & Parity Highlights

- **Complete Visual & Functional Parity**: Exact layout matching FreeVideoSave.com including Hero badge, dynamic title, search box with link icon, quick paste button, source platform pills, preview player, how-to 3-step guide, 6-card technology section, digital knowledge base, 12 interactive FAQs, DMCA compliance, rich SEO footer, and brand dark banner.
- **Enhanced Design Layout**:
  - Glassmorphic accents and vibrant gradient brand theme (`#ff4db8` to `#7c3aed`).
  - Clear URL button (`X`) for quick resetting.
  - Category Filter Tabs (`All Files`, `Videos`, `Audio MP3`, `Photos`).
  - Animated loading spinner with real-time fetch feedback.
  - High-res embedded player (`<video>` & `<audio>`) preview.
  - Multi-item sequential "Download All Files" batch action.
- **Multi-Platform Support**:
  - **Instagram**: Reels, Stories, Posts, and multi-slide Carousel galleries.
  - **YouTube**: Videos, Shorts, 4K/1080p/720p MP4, and M4A/MP3 sound extraction.
  - **TikTok**: HD watermark-free video streams and audio tracks.
  - **Facebook**: Public HD/SD MP4 videos and Reels.
  - **Twitter / X**: Video tweets and GIFs.
  - **Pinterest**: Pins, videos, and full-resolution images.
  - **Universal**: Supports 1000+ sites powered by tuned yt-dlp pipelines.
- **Direct Attachment Streaming Proxy (`/api/proxy-download`)**:
  - Bypasses cross-origin CORS limitations and anti-hotlinking protections.
  - Forces clean direct disk downloads to the user's `Downloads` folder with custom filenames.
- **PWA & Mobile-First**:
  - Fully responsive on iOS Safari, Android Chrome, and desktop browsers.
  - Includes `manifest.json` and `sw.js` (Service Worker) for installability.
  - Native Google install prompt caching and deferred trigger.

---

## 📂 Project Structure

```text
vidsavor/
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI server (API routes & static mounts)
│   └── extractor.py           # Multi-engine media extractor & fallbacks
├── static/
│   ├── css/
│   │   └── style.css          # Core VidSavor stylesheet
│   ├── js/
│   │   └── app.js             # Client engine (fetch, download, batch, PWA)
│   ├── assets/
│   │   ├── logo.svg           # High-resolution vector logo
│   │   └── favicon.svg        # Vector favicon
│   ├── index.html             # Homepage (All-in-one downloader)
│   ├── reels.html             # Dedicated Video & Reels mode
│   ├── audio.html             # Dedicated MP3 Audio extractor
│   ├── photo.html             # Dedicated Photo & Carousel saver
│   ├── contact-us.html        # Interactive Contact Us page
│   ├── privacy-policy.html    # Privacy Policy page
│   ├── terms-of-service.html  # Terms of Service page
│   ├── dmca-policy.html       # DMCA Copyright Compliance page
│   ├── about-us.html          # About Platform page
│   ├── blog.html              # Blog & Knowledge center
│   ├── manifest.json          # PWA Manifest
│   ├── sw.js                  # PWA Service Worker
│   └── robots.txt             # Search engine crawler directives
├── requirements.txt           # Python dependencies
├── run.py                     # Server launch script
└── README.md                  # Documentation
```

---

## 🚀 Quick Start Guide

### 1. Requirements
- Python 3.10+ (or `uv`)
- Modern web browser

### 2. Run with Virtual Environment
```bash
# Navigate to project
cd C:\Users\B1\.gemini\antigravity\scratch\vidsavor

# Activate virtual environment
.venv\Scripts\activate

# Launch the server
python run.py
```

Open your browser at: **`http://localhost:8000`**

---

## 🌐 API Contract (`POST /fetch`)

### Request
```json
POST /fetch
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### Response
```json
{
  "status": "success",
  "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "type": "video",
  "download": "https://...",
  "author": "Rick Astley",
  "duration": "03:33",
  "platform": "youtube",
  "results": [
    {
      "url": "https://...",
      "type": "video",
      "quality": "1080p Full HD",
      "format": "mp4",
      "size": "45.2 MB",
      "thumbnail": "https://..."
    },
    {
      "url": "https://...",
      "type": "audio",
      "quality": "320kbps High Audio",
      "format": "mp3",
      "size": "8.4 MB",
      "thumbnail": "https://..."
    }
  ]
}
```

---

## 🛡️ DMCA & Copyright Compliance
VidSavor operates in full compliance with **17 U.S.C. § 512** (DMCA). The platform does not host, broadcast, or store copyrighted files. All extraction is executed transiently from publicly accessible URLs.
