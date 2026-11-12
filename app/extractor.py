import re
import math
import logging
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

def unshorten_url(url: str) -> str:
    """Follow redirects for short links (pin.it, youtu.be, fb.watch, t.co)."""
    try:
        if any(short in url.lower() for short in ['pin.it', 'fb.watch', 't.co', 'bit.ly', 'vm.tiktok.com', 'vt.tiktok.com']):
            resp = requests.head(url, allow_redirects=True, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
            return resp.url
    except Exception as e:
        logger.debug(f"Unshorten error: {e}")
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
        url = raw_url.strip()
        if not url:
            return {"status": "error", "message": "Please provide a valid video link."}

        url = unshorten_url(url)
        platform = detect_platform(url)

        # Primary extraction using yt-dlp
        try:
            ydl_opts = dict(self.ydl_opts_base)
            # Default options allow extracting all formats
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise Exception("No media information retrieved")

                return self._parse_info(info, platform, url)

        except Exception as e:
            logger.warning(f"yt-dlp extraction failed for {url}: {e}. Trying fallback...")
            return self._fallback_extract(url, platform, str(e))

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
            size_label = human_filesize(size_bytes)
            vcodec = f.get('vcodec') or 'none'
            acodec = f.get('acodec') or 'none'

            has_video = vcodec != 'none'
            has_audio = acodec != 'none'

            if has_video and has_audio:
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

        # If combined videos are fewer than 2, offer the highest resolution video streams as well
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
                "quality": "HD Poster / Thumbnail",
                "format": "jpg",
                "size": "Original Quality",
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
            entry_title = entry.get('title') or f"Slide {idx + 1}"
            entry_thumb = entry.get('thumbnail') or thumbnail
            entry_formats = entry.get('formats') or []
            
            # Find direct video or direct image
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

    def _fallback_extract(self, url: str, platform: str, error_msg: str) -> Dict[str, Any]:
        """Fallback extractors using HTML metadata, OpenGraph, or platform APIs."""
        try:
            # 1. Twitter / X fallback via FixupX
            if platform == 'twitter':
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

            # 2. General OpenGraph scraping fallback
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
            logger.error(f"Fallback scraper also failed: {fallback_err}")

        # Construct informative, helpful error message
        friendly_msg = "Media not found! Please check that the URL is public and not from a private or deleted post."
        if 'private' in error_msg.lower():
            friendly_msg = "This media belongs to a private account and cannot be downloaded."
        elif 'login' in error_msg.lower():
            friendly_msg = "This platform requires authentication for this link. Please verify the link is publicly accessible."
        elif '404' in error_msg or 'not found' in error_msg.lower():
            friendly_msg = "Content was not found or has been removed by the creator."

        return {
            "status": "error",
            "message": friendly_msg
        }

# Global extractor singleton
extractor = MediaExtractor()
