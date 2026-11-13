import re
import math
import logging
import urllib.parse
import requests
import yt_dlp
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

def human_filesize(num_bytes: Optional[int]) -> str:
    """Format bytes into readable size string."""
    if not num_bytes or num_bytes <= 0:
        return "Unknown Size"
    units = ['B', 'KB', 'MB', 'GB']
    i = 0
    size = float(num_bytes)
    while size >= 1024.0 and i < len(units) - 1:
        size /= 1024.0
        i += 1
    return f"{size:.1f} {units[i]}"

def estimate_stream_size(height: int, duration_sec: Optional[float], is_audio: bool = False, abr: Optional[int] = None) -> str:
    """Provide realistic filesize estimate in MB when CDN omits Content-Length."""
    d = float(duration_sec) if duration_sec and duration_sec > 0 else 30.0
    if is_audio:
        bitrate = abr if abr and abr > 0 else 128
        bytes_val = int((bitrate * 1024 / 8) * d)
    else:
        if height >= 1440:
            bitrate = 5500
        elif height >= 1080:
            bitrate = 3200
        elif height >= 720:
            bitrate = 1600
        elif height >= 480:
            bitrate = 850
        elif height > 0:
            bitrate = 500
        else:
            bitrate = 1500
        bytes_val = int((bitrate * 1024 / 8) * d)
    return human_filesize(bytes_val)

def format_duration(seconds: Optional[int]) -> str:
    """Format seconds into MM:SS or HH:MM:SS."""
    if not seconds or seconds <= 0:
        return ""
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

def detect_platform(url: str) -> str:
    """Identify which platform the given URL belongs to."""
    u = url.lower()
    if 'youtube.com' in u or 'youtu.be' in u:
        return 'youtube'
    if 'instagram.com' in u or 'instagr.am' in u:
        return 'instagram'
    if 'tiktok.com' in u or 'douyin.com' in u:
        return 'tiktok'
    if 'facebook.com' in u or 'fb.watch' in u or 'fb.com' in u:
        return 'facebook'
    if 'twitter.com' in u or 'x.com' in u or 't.co' in u:
        return 'twitter'
    if 'pinterest.com' in u or 'pin.it' in u:
        return 'pinterest'
    if 'reddit.com' in u or 'v.redd.it' in u:
        return 'reddit'
    if 'threads.net' in u:
        return 'threads'
    return 'universal'

def clean_media_url(raw_url: str) -> str:
    """Remove tracking query strings and follow short-links."""
    url = raw_url.strip()
    # Unshorten known redirects
    try:
        if any(short in url.lower() for short in ['pin.it', 'fb.watch', 't.co', 'bit.ly', 'vm.tiktok.com', 'vt.tiktok.com']):
            resp = requests.head(url, allow_redirects=True, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
            url = resp.url
    except Exception:
        pass

    # Strip Instagram tracking params (igsh, utm_source, etc.)
    if 'instagram.com' in url.lower():
        url = re.sub(r'[?&](igsh|utm_[^&]+|ig_mid)=[^&#]*', '', url)
        if url.endswith('?') or url.endswith('&'):
            url = url[:-1]

    return url

class MediaExtractor:
    def __init__(self):
        self.ydl_opts_base = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'extract_flat': False,
            'noplaylist': True,
            'socket_timeout': 15,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }

    def extract(self, raw_url: str) -> Dict[str, Any]:
        """Main entry point to extract media from URL."""
        if not raw_url or not raw_url.strip():
            return {"status": "error", "message": "Please provide a valid video link."}

        url = clean_media_url(raw_url)
        platform = detect_platform(url)

        # 1. Primary: yt-dlp Extraction
        try:
            ydl_opts = dict(self.ydl_opts_base)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    return self._parse_info(info, platform, url)
        except Exception as e:
            logger.warning(f"yt-dlp extraction failed for {url}: {e}. Trying fallback engines...")
            pass

        # 2. Secondary: Specialized Platform Fallbacks
        fallback_res = self._fallback_extract(url, platform)
        if fallback_res:
            return fallback_res

        # 3. Informative, user-friendly error response
        if platform == 'instagram':
            msg = "Instagram media not found or inaccessible. Please verify the account is public (not private), the post hasn't been deleted, and retry."
        elif platform == 'tiktok':
            msg = "TikTok video not found. Please ensure the link is a valid public TikTok video URL and try again."
        elif platform == 'youtube':
            msg = "YouTube video not found. Please verify the link is public and accessible."
        else:
            msg = "Media not found! Please check that the link is valid and from a public post, then retry."

        return {
            "status": "error",
            "message": msg
        }

    def _parse_info(self, info: Dict[str, Any], platform: str, url: str) -> Dict[str, Any]:
        """Convert yt-dlp info dictionary to standard VidSavor format."""
        # Check if this is a playlist/carousel (e.g. Instagram multi-slide post)
        entries = info.get('entries')
        if entries and isinstance(entries, list):
            return self._parse_carousel(entries, info, platform)

        title = info.get('title') or f"{platform.capitalize()} Media"
        thumbnail = info.get('thumbnail') or ""
        author = info.get('uploader') or info.get('channel') or info.get('creator') or ""
        duration_sec = info.get('duration')
        duration = format_duration(duration_sec) if duration_sec else ""

        formats = info.get('formats') or []
        results = []

        combined_videos = []
        video_only = []
        audio_streams = []

        for f in formats:
            stream_url = f.get('url')
            if not stream_url:
                continue

            ext = f.get('ext') or 'mp4'
            height = f.get('height') or 0
            size_bytes = f.get('filesize') or f.get('filesize_approx')
            vcodec = f.get('vcodec') or 'none'
            acodec = f.get('acodec') or 'none'

            has_video = vcodec != 'none'
            has_audio = acodec != 'none'

            if has_video and has_audio:
                size_label = human_filesize(size_bytes) if (size_bytes and size_bytes > 0) else estimate_stream_size(height, duration_sec, is_audio=False)
                label = f"{height}p Full HD" if height >= 1080 else (f"{height}p HD" if height >= 720 else (f"{height}p" if height > 0 else "HD MP4"))
                combined_videos.append({
                    "url": stream_url,
                    "type": "video",
                    "quality": label,
                    "height": height,
                    "format": ext,
                    "size": size_label,
                    "thumbnail": thumbnail
                })
            elif has_video and not has_audio:
                size_label = human_filesize(size_bytes) if (size_bytes and size_bytes > 0) else estimate_stream_size(height, duration_sec, is_audio=False)
                label = f"{height}p Video Stream" if height > 0 else "Video"
                video_only.append({
                    "url": stream_url,
                    "type": "video",
                    "quality": label,
                    "height": height,
                    "format": ext,
                    "size": size_label,
                    "thumbnail": thumbnail
                })
            elif has_audio and not has_video:
                raw_abr = f.get('abr')
                abr_val = int(raw_abr) if raw_abr else 128
                size_label = human_filesize(size_bytes) if (size_bytes and size_bytes > 0) else estimate_stream_size(0, duration_sec, is_audio=True, abr=abr_val)
                audio_streams.append({
                    "url": stream_url,
                    "type": "audio",
                    "quality": f"{abr_val}kbps High Audio",
                    "abr": abr_val,
                    "format": "mp3" if ext in ['mp3', 'm4a', 'aac'] else ext,
                    "size": size_label,
                    "thumbnail": thumbnail
                })

        # Sort and deduplicate combined videos
        combined_videos.sort(key=lambda x: x.get('height', 0), reverse=True)
        seen_h = set()
        for v in combined_videos:
            h = v.get('height', 0)
            if h not in seen_h:
                seen_h.add(h)
                results.append(v)

        # Include high-resolution streams if combined streams are limited
        if len(results) < 2 and video_only:
            video_only.sort(key=lambda x: x.get('height', 0), reverse=True)
            for v in video_only:
                h = v.get('height', 0)
                if h not in seen_h and h >= 360:
                    seen_h.add(h)
                    results.append(v)
                if len(results) >= 4:
                    break

        # Sort and deduplicate audio streams
        audio_streams.sort(key=lambda x: x.get('abr', 0), reverse=True)
        seen_abr = set()
        for a in audio_streams:
            abr = a.get('abr', 0)
            if abr not in seen_abr:
                seen_abr.add(abr)
                results.append(a)
            if len(seen_abr) >= 2:
                break

        # Fallback if no format parsed but info has a direct url
        if not results and info.get('url'):
            results.append({
                "url": info.get('url'),
                "type": "video",
                "quality": "Direct Video",
                "format": info.get('ext') or "mp4",
                "size": human_filesize(info.get('filesize')),
                "thumbnail": thumbnail
            })

        # Always offer original thumbnail / poster download
        if thumbnail:
            results.append({
                "url": thumbnail,
                "type": "photo",
                "quality": "HD Cover Poster",
                "format": "jpg",
                "size": "Original JPG",
                "thumbnail": thumbnail
            })

        primary_download = results[0]['url'] if results else (thumbnail or "")
        primary_type = results[0]['type'] if results else 'video'

        return {
            "status": "success",
            "title": title,
            "thumbnail": thumbnail,
            "type": primary_type,
            "download": primary_download,
            "author": author,
            "duration": duration,
            "platform": platform,
            "results": results
        }

    def _parse_carousel(self, entries: List[Dict[str, Any]], info: Dict[str, Any], platform: str) -> Dict[str, Any]:
        """Handle multi-item posts (Instagram albums, playlists, carousel slides)."""
        title = info.get('title') or f"{platform.capitalize()} Album / Gallery"
        thumbnail = info.get('thumbnail') or ""
        results = []

        for idx, entry in enumerate(entries):
            if not entry:
                continue
            entry_thumb = entry.get('thumbnail') or thumbnail
            entry_formats = entry.get('formats') or []
            
            stream_url = None
            media_type = 'photo'
            size_bytes = None

            for f in reversed(entry_formats):
                if f.get('url'):
                    stream_url = f.get('url')
                    size_bytes = f.get('filesize') or f.get('filesize_approx')
                    if f.get('vcodec') and f.get('vcodec') != 'none':
                        media_type = 'video'
                    break

            if not stream_url:
                stream_url = entry.get('url') or entry_thumb
                media_type = 'photo'

            if not thumbnail and entry_thumb:
                thumbnail = entry_thumb

            results.append({
                "url": stream_url,
                "type": media_type,
                "quality": f"{media_type.capitalize()} #{idx + 1}",
                "format": "mp4" if media_type == 'video' else "jpg",
                "size": human_filesize(size_bytes),
                "thumbnail": entry_thumb
            })

        primary_download = results[0]['url'] if results else thumbnail
        primary_type = results[0]['type'] if results else 'photo'

        return {
            "status": "success",
            "title": title,
            "thumbnail": thumbnail,
            "type": primary_type,
            "download": primary_download,
            "author": info.get('uploader') or "",
            "duration": "",
            "platform": platform,
            "results": results
        }

    def _fallback_extract(self, url: str, platform: str) -> Optional[Dict[str, Any]]:
        """Fallback extractors using platform-specific APIs and HTML metadata."""
        # 1. TikTok fallback via TikWM
        if platform == 'tiktok':
            try:
                twm_res = requests.get(f"https://www.tikwm.com/api/?url={urllib.parse.quote(url)}", timeout=8, headers={'User-Agent': 'Mozilla/5.0'})
                if twm_res.status_code == 200:
                    tdata = twm_res.json()
                    if tdata.get('code') == 0 and tdata.get('data'):
                        d = tdata['data']
                        results = []
                        play_url = d.get('play') or d.get('wmplay')
                        hdplay = d.get('hdplay')
                        music = d.get('music')
                        cover = d.get('cover') or d.get('origin_cover')
                        title = d.get('title') or "TikTok Video Without Watermark"
                        author = d.get('author', {}).get('nickname') or d.get('author', {}).get('unique_id') or "TikTok Creator"
                        duration_s = d.get('duration') or 0

                        if hdplay:
                            results.append({
                                "url": hdplay,
                                "type": "video",
                                "quality": "1080p HD (No Watermark)",
                                "format": "mp4",
                                "size": human_filesize(d.get('size')),
                                "thumbnail": cover
                            })
                        if play_url:
                            results.append({
                                "url": play_url,
                                "type": "video",
                                "quality": "HD Video (No Watermark)",
                                "format": "mp4",
                                "size": human_filesize(d.get('size')),
                                "thumbnail": cover
                            })
                        if music:
                            results.append({
                                "url": music,
                                "type": "audio",
                                "quality": "Original Audio MP3",
                                "format": "mp3",
                                "size": "Audio Stream",
                                "thumbnail": cover
                            })
                        if cover:
                            results.append({
                                "url": cover,
                                "type": "photo",
                                "quality": "Cover Photo",
                                "format": "jpg",
                                "size": "Original",
                                "thumbnail": cover
                            })

                        if results:
                            return {
                                "status": "success",
                                "title": title[:100],
                                "thumbnail": cover or "",
                                "type": "video",
                                "download": results[0]['url'],
                                "author": author,
                                "duration": format_duration(duration_s),
                                "platform": "tiktok",
                                "results": results
                            }
            except Exception as e:
                logger.warning(f"TikWM fallback failed: {e}")

        # 2. Twitter / X fallback via FixupX
        if platform == 'twitter':
            try:
                tw_match = re.search(r'status/(\d+)', url)
                if tw_match:
                    tweet_id = tw_match.group(1)
                    api_url = f"https://api.fxtwitter.com/status/{tweet_id}"
                    resp = requests.get(api_url, timeout=6, headers={'User-Agent': 'Mozilla/5.0'})
                    if resp.status_code == 200:
                        data = resp.json().get('tweet', {})
                        media = data.get('media', {})
                        videos = media.get('videos', [])
                        photos = media.get('photos', [])
                        results = []
                        thumb = data.get('thumbnail') or ""
                        
                        for v in videos:
                            results.append({
                                "url": v.get('url'),
                                "type": "video",
                                "quality": "HD Video",
                                "format": "mp4",
                                "size": "Direct Stream",
                                "thumbnail": v.get('thumbnail_url') or thumb
                            })
                        for p in photos:
                            results.append({
                                "url": p.get('url'),
                                "type": "photo",
                                "quality": "HD Photo",
                                "format": "jpg",
                                "size": "Direct Image",
                                "thumbnail": p.get('url')
                            })

                        if results:
                            return {
                                "status": "success",
                                "title": data.get('text', f"Twitter Post {tweet_id}")[:60],
                                "thumbnail": results[0].get('thumbnail') or thumb,
                                "type": results[0]['type'],
                                "download": results[0]['url'],
                                "author": data.get('author', {}).get('name', 'Twitter User'),
                                "duration": "",
                                "platform": "twitter",
                                "results": results
                            }
            except Exception as e:
                logger.warning(f"Twitter fallback failed: {e}")

        # 3. Instagram oEmbed fallback
        if platform == 'instagram':
            try:
                oembed_res = requests.get(f"https://api.instagram.com/oembed/?url={urllib.parse.quote(url)}", timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
                if oembed_res.status_code == 200:
                    odata = oembed_res.json()
                    thumb = odata.get('thumbnail_url')
                    if thumb:
                        return {
                            "status": "success",
                            "title": odata.get('title') or "Instagram Media",
                            "thumbnail": thumb,
                            "type": "photo",
                            "download": thumb,
                            "author": odata.get('author_name') or "Instagram User",
                            "duration": "",
                            "platform": "instagram",
                            "results": [{
                                "url": thumb,
                                "type": "photo",
                                "quality": "High-Res Image / Cover",
                                "format": "jpg",
                                "size": "Source Quality",
                                "thumbnail": thumb
                            }]
                        }
            except Exception as e:
                logger.warning(f"Instagram oEmbed fallback failed: {e}")

        # 4. General OpenGraph scraping fallback
        try:
            resp = requests.get(url, timeout=8, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            })
            html = resp.text

            og_title = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html)
            og_video = re.search(r'<meta[^>]+property=["\']og:video(?:[:_]url)?["\'][^>]+content=["\']([^"\']+)["\']', html)
            og_image = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)

            video_url = og_video.group(1) if og_video else None
            image_url = og_image.group(1) if og_image else None
            title = og_title.group(1) if og_title else f"{platform.capitalize()} Extracted Media"

            results = []
            if video_url:
                results.append({
                    "url": video_url,
                    "type": "video",
                    "quality": "HD MP4",
                    "format": "mp4",
                    "size": "Source Stream",
                    "thumbnail": image_url or ""
                })
            if image_url:
                results.append({
                    "url": image_url,
                    "type": "photo",
                    "quality": "Original Image",
                    "format": "jpg",
                    "size": "Original",
                    "thumbnail": image_url
                })

            if results:
                return {
                    "status": "success",
                    "title": title,
                    "thumbnail": image_url or "",
                    "type": results[0]['type'],
                    "download": results[0]['url'],
                    "author": "",
                    "duration": "",
                    "platform": platform,
                    "results": results
                }

        except Exception as fallback_err:
            logger.error(f"Fallback scraper failed: {fallback_err}")

        return None

# Global extractor singleton
extractor = MediaExtractor()
