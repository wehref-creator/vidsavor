import re
import math
import logging
import urllib.parse
import base64
import json
from typing import Dict, Any, List, Optional
import requests
import yt_dlp

logger = logging.getLogger(__name__)

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

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
    if 'pinterest.com' in u or 'pin.it' in u:
        return 'pinterest'
    if 'twitter.com' in u or 'x.com' in u or 't.co/' in u:
        return 'twitter'
    if 'reddit.com' in u or 'v.redd.it' in u:
        return 'reddit'
    if 'threads.net' in u:
        return 'threads'
    return 'universal'

def canonicalize_url(raw_url: str) -> str:
    """Normalize short-links, mobile links, and platform-specific formats."""
    url = raw_url.strip()

    # Follow short-links for known redirect domains
    if any(short in url.lower() for short in ['pin.it', 'fb.watch', 't.co', 'bit.ly', 'vm.tiktok.com', 'vt.tiktok.com']):
        try:
            resp = requests.head(url, allow_redirects=True, timeout=4, headers={'User-Agent': USER_AGENT})
            if resp.url:
                url = resp.url
        except Exception:
            pass

    # YouTube canonicalization (Shorts, youtu.be, embed, watch?v=, mobile -> clean watch?v=ID)
    if 'youtube.com' in url.lower() or 'youtu.be' in url.lower():
        m = (
            re.search(r'(?:v=|\/v\/|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', url) or
            re.search(r'(?:^|[\?&])v=([a-zA-Z0-9_-]{11})', url)
        )
        if m:
            return f"https://www.youtube.com/watch?v={m.group(1)}"

    # Instagram parameter cleanup
    if 'instagram.com' in url.lower() or 'instagr.am' in url.lower():
        url = re.sub(r'[?&](igsh|utm_[^&]+|ig_mid)=[^&#]*', '', url)
        if url.endswith('?') or url.endswith('&'):
            url = url[:-1]

    # Facebook parameter cleanup
    if 'facebook.com' in url.lower() or 'fb.com' in url.lower():
        url = re.sub(r'[?&](mibextid|sfnsn|rdid|ref)=[^&#]*', '', url)
        if url.endswith('?') or url.endswith('&'):
            url = url[:-1]

    return url

def decode_hunter(h_str: str, n_str: str, t_val: int, e_val: int) -> str:
    """Decodes Dean Edwards / Hunter packed JavaScript used by SaveInsta/SaveVids."""
    r_out = ""
    i = 0
    length = len(h_str)
    sep = n_str[e_val]
    while i < length:
        s = ""
        while i < length and h_str[i] != sep:
            s += h_str[i]
            i += 1
        i += 1
        for j in range(len(n_str)):
            s = s.replace(n_str[j], str(j))
        if s:
            try:
                char_code = int(s, e_val) - t_val
                if char_code > 0:
                    r_out += chr(char_code)
            except Exception:
                pass
    try:
        return urllib.parse.unquote(r_out)
    except Exception:
        return r_out

def unpack_token_url(url: Optional[str]) -> str:
    """
    Unpacks direct origin CDN media URLs (e.g. scontent.cdninstagram.com, fbcdn.net)
    from JWT-proxied links (dl.snapcdn.app, d.rapidcdn.app, savevids, saveinsta).
    """
    if not url or not isinstance(url, str):
        return "" if url is None else url

    url = url.strip()
    if "token=" in url:
        try:
            match = re.search(r'[?&]token=([^&#\s]+)', url)
            if match:
                token_str = match.group(1)
                parts = token_str.split('.')
                if len(parts) >= 2:
                    payload = parts[1]
                    payload += '=' * (-len(payload) % 4)
                    raw_bytes = base64.urlsafe_b64decode(payload.encode('ascii'))
                    data = json.loads(raw_bytes.decode('utf-8', errors='ignore'))
                    if isinstance(data, dict) and data.get("url") and isinstance(data["url"], str):
                        cand = data["url"].strip().replace('&amp;', '&')
                        if cand.startswith("http"):
                            return unpack_token_url(cand)
        except Exception:
            pass

    return url

def sanitize_result(res: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Sanitizes all media URLs in an extraction result to direct origin CDN links and ensures audio stream availability."""
    if not res or not isinstance(res, dict):
        return res
    if res.get("download"):
        res["download"] = unpack_token_url(res["download"])
    if res.get("thumbnail"):
        res["thumbnail"] = unpack_token_url(res["thumbnail"])
    if res.get("results") and isinstance(res["results"], list):
        for item in res["results"]:
            if isinstance(item, dict):
                if item.get("url"):
                    item["url"] = unpack_token_url(item["url"])
                if item.get("thumbnail"):
                    item["thumbnail"] = unpack_token_url(item["thumbnail"])

        # Ensure an Audio (MP3) extraction option is always available for any video stream
        has_audio = any(r.get("type") == "audio" or r.get("format") == "mp3" for r in res["results"] if isinstance(r, dict))
        has_video = any(r.get("type") == "video" for r in res["results"] if isinstance(r, dict))
        if not has_audio and has_video:
            primary_vid = next(r for r in res["results"] if isinstance(r, dict) and r.get("type") == "video")
            res["results"].append({
                "url": primary_vid["url"],
                "token": primary_vid.get("token"),
                "type": "audio",
                "quality": "Original Audio (MP3)",
                "format": "mp3",
                "has_audio": True,
                "size": "Audio Stream",
                "thumbnail": res.get("thumbnail") or primary_vid.get("thumbnail", "")
            })
    return res

class MediaExtractor:
    def __init__(self):
        self.ydl_opts_base = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'extract_flat': False,
            'noplaylist': True,
            'socket_timeout': 8,
            'extractor_args': {'youtube': {'player_client': ['ios', 'android', 'mweb', 'web']}},
            'user_agent': USER_AGENT,
        }

    def extract(self, raw_url: str) -> Dict[str, Any]:
        """Main multi-platform extraction pipeline."""
        if not raw_url or not raw_url.strip():
            return {"status": "error", "message": "Please provide a valid media link."}

        url = canonicalize_url(raw_url)
        platform = detect_platform(url)

        # 1. YouTube Dedicated Handler
        if platform == 'youtube':
            res = self._extract_youtube(url)
            if res and res.get('status') == 'success' and res.get('results'):
                return sanitize_result(res)

        # 2. TikTok Dedicated Handler
        elif platform == 'tiktok':
            res = self._extract_tiktok(url)
            if res and res.get('status') == 'success' and res.get('results'):
                return sanitize_result(res)

        # 3. Instagram Dedicated Handler
        elif platform == 'instagram':
            res = self._extract_instagram(url)
            if res and res.get('status') == 'success' and res.get('results'):
                return sanitize_result(res)

        # 4. Facebook Dedicated Handler
        elif platform == 'facebook':
            res = self._extract_facebook(url)
            if res and res.get('status') == 'success' and res.get('results'):
                return sanitize_result(res)

        # 5. Pinterest Dedicated Handler
        elif platform == 'pinterest':
            res = self._extract_pinterest(url)
            if res and res.get('status') == 'success' and res.get('results'):
                return sanitize_result(res)

        # 6. Twitter / X Dedicated Handler
        elif platform == 'twitter':
            res = self._extract_twitter(url)
            if res and res.get('status') == 'success' and res.get('results'):
                return sanitize_result(res)

        # Fallback to Universal yt-dlp
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts_base) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    parsed = self._parse_info(info, platform, url)
                    if parsed and parsed.get('results'):
                        return sanitize_result(parsed)
        except Exception as e:
            logger.warning(f"Universal yt-dlp fallback error: {e}")

        # Fallback to OpenGraph Scraper (Only for non-YouTube media; never return photo-only for a YouTube video)
        if platform != 'youtube':
            og_res = self._extract_opengraph(url, platform)
            if og_res and og_res.get('status') == 'success' and og_res.get('results'):
                return sanitize_result(og_res)

        # Informative error message based on platform
        error_messages = {
            'youtube': "Could not fetch YouTube video. Please verify the video is public, accessible, and not age-restricted.",
            'instagram': "Could not fetch Instagram post or reel. Please verify the account is public (not private) and the post has not been deleted.",
            'tiktok': "Could not fetch TikTok video. Please ensure the link is a valid public TikTok video URL and try again.",
            'facebook': "Could not fetch Facebook video. Please make sure the video or reel is public and accessible without login.",
            'twitter': "Could not fetch Twitter/X media. Please ensure the post contains a video or photo and is from a public account.",
            'pinterest': "Could not fetch Pinterest pin. Please ensure the pin is public and accessible.",
        }
        return {
            "status": "error",
            "message": error_messages.get(platform, "Media not found! Please check that the link is valid and from a public post, then retry.")
        }

    # =========================================================================
    # 1. YOUTUBE EXTRACTOR
    # =========================================================================
    def _extract_youtube(self, url: str) -> Optional[Dict[str, Any]]:
        # Extract 11-char video ID and ensure clean canonical URL
        m = (
            re.search(r'(?:v=|\/v\/|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', url) or
            re.search(r'(?:^|[\?&])v=([a-zA-Z0-9_-]{11})', url)
        )
        video_id = m.group(1) if m else None
        clean_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else url

        # Tier 0: High-Speed Instant Cloud Parser (YouTube oEmbed & SaveNow Engine)
        try:
            oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(clean_url)}&format=json"
            oe_resp = requests.get(oembed_url, headers={'User-Agent': USER_AGENT}, timeout=5)
            if oe_resp.status_code == 200:
                oe_data = oe_resp.json()
                title = oe_data.get('title') or "YouTube Video"
                author = oe_data.get('author_name') or "YouTube Creator"
                thumbnail = oe_data.get('thumbnail_url') or (f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg" if video_id else "")

                results = [
                    {
                        "url": clean_url,
                        "token": "savenow:1080",
                        "type": "video",
                        "quality": "1080p Full HD",
                        "has_audio": True,
                        "format": "mp4",
                        "size": "Full HD",
                        "thumbnail": thumbnail
                    },
                    {
                        "url": clean_url,
                        "token": "savenow:720",
                        "type": "video",
                        "quality": "720p HD",
                        "has_audio": True,
                        "format": "mp4",
                        "size": "HD 720p",
                        "thumbnail": thumbnail
                    },
                    {
                        "url": clean_url,
                        "token": "savenow:480",
                        "type": "video",
                        "quality": "480p SD",
                        "has_audio": True,
                        "format": "mp4",
                        "size": "Standard 480p",
                        "thumbnail": thumbnail
                    },
                    {
                        "url": clean_url,
                        "token": "savenow:360",
                        "type": "video",
                        "quality": "360p Medium",
                        "has_audio": True,
                        "format": "mp4",
                        "size": "Medium 360p",
                        "thumbnail": thumbnail
                    },
                    {
                        "url": clean_url,
                        "token": "savenow:mp3",
                        "type": "audio",
                        "quality": "320kbps High Quality Audio (MP3)",
                        "has_audio": True,
                        "format": "mp3",
                        "size": "320kbps MP3",
                        "thumbnail": thumbnail
                    },
                    {
                        "url": clean_url,
                        "token": "savenow:m4a",
                        "type": "audio",
                        "quality": "Original Stereo Audio (M4A)",
                        "has_audio": True,
                        "format": "m4a",
                        "size": "Fast M4A",
                        "thumbnail": thumbnail
                    }
                ]
                if thumbnail:
                    results.append({
                        "url": thumbnail,
                        "type": "photo",
                        "quality": "Original Cover Poster (JPG)",
                        "format": "jpg",
                        "size": "Original JPG",
                        "thumbnail": thumbnail
                    })

                return {
                    "status": "success",
                    "title": title,
                    "thumbnail": thumbnail,
                    "type": "video",
                    "download": results[0]['url'],
                    "author": author,
                    "duration": "",
                    "platform": "youtube",
                    "results": results
                }
        except Exception as e:
            logger.warning(f"YouTube oEmbed primary error: {e}")

        # Tier 1: Direct yt-dlp Extractor
        try:
            ydl_opts = dict(self.ydl_opts_base)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=False)
                if info:
                    parsed = self._parse_info(info, 'youtube', clean_url)
                    if parsed and parsed.get('results'):
                        return parsed
        except Exception as e:
            logger.warning(f"YouTube yt-dlp primary error: {e}")

        # Tier 1: Hostinger Grapweb Parse API (Try POST first to avoid ModSecurity query string filtering, then GET fallback)
        for method in ['POST', 'GET']:
            try:
                if method == 'POST':
                    resp = requests.post(
                        "https://grapweb.com/youtube/api.php",
                        data={"action": "parse", "url": clean_url},
                        timeout=10,
                        headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'}
                    )
                else:
                    parse_url = "https://grapweb.com/youtube/api.php?action=parse&url=" + urllib.parse.quote(clean_url)
                    resp = requests.get(parse_url, timeout=10, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})

                if resp and resp.status_code == 200:
                    data = resp.json()
                    if data and data.get('status') == 'success' and data.get('data'):
                        info = data['data']
                        title = info.get('title') or "YouTube Video"
                        thumbnail = info.get('thumbnail') or (f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg" if video_id else "")
                        author = info.get('author') or "YouTube Creator"
                        duration = info.get('durationFormatted') or ""

                        results = []
                        seen_qualities = set()

                        for v in info.get('videos', []):
                            q = v.get('quality', '').upper()
                            token = v.get('resource_content') or ''
                            dl_url = v.get('download_url') or ''
                            size_str = v.get('sizeFormatted') or 'HD Stream'

                            clean_q = q
                            if clean_q in seen_qualities:
                                continue
                            seen_qualities.add(clean_q)

                            if clean_q in ['1080P', '1080P60', 'FHD']:
                                label = "1080p Full HD"
                            elif clean_q in ['720P', 'HD']:
                                label = "720p HD"
                            elif clean_q == '2160P':
                                label = "2160p (4K Ultra HD)"
                            elif clean_q == '1440P':
                                label = "1440p (2K QHD)"
                            elif clean_q == '480P':
                                label = "480p SD"
                            elif clean_q == '360P':
                                label = "360p"
                            else:
                                label = f"{clean_q.lower()}"

                            target_url = dl_url if dl_url else token
                            if not target_url:
                                continue

                            results.append({
                                "url": target_url,
                                "token": "" if dl_url else token,
                                "type": "video",
                                "quality": label,
                                "has_audio": True,
                                "format": "mp4",
                                "size": size_str,
                                "thumbnail": thumbnail
                            })

                        for a in info.get('audios', []):
                            q = a.get('quality', '').upper()
                            token = a.get('resource_content') or ''
                            dl_url = a.get('download_url') or ''
                            size_str = a.get('sizeFormatted') or 'High Audio'
                            target_url = dl_url if dl_url else token
                            if not target_url:
                                continue

                            results.append({
                                "url": target_url,
                                "token": "" if dl_url else token,
                                "type": "audio",
                                "quality": f"{q} Audio (MP3)",
                                "has_audio": True,
                                "format": "mp3",
                                "size": size_str,
                                "thumbnail": thumbnail
                            })

                        if thumbnail:
                            results.append({
                                "url": thumbnail,
                                "type": "photo",
                                "quality": "HD Cover Poster (JPG)",
                                "format": "jpg",
                                "size": "Original JPG",
                                "thumbnail": thumbnail
                            })

                        if results:
                            return {
                                "status": "success",
                                "title": title,
                                "thumbnail": thumbnail,
                                "type": "video",
                                "download": results[0]['url'],
                                "author": author,
                                "duration": duration,
                                "platform": "youtube",
                                "results": results
                            }
            except Exception as e:
                logger.warning(f"YouTube Grapweb parse {method} error: {e}")

        # Tier 2: yt-dlp Progressive Extractor
        try:
            ydl_opts = dict(self.ydl_opts_base)
            ydl_opts['format'] = 'best[ext=mp4]/best'
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    parsed = self._parse_info(info, 'youtube', url)
                    if parsed and parsed.get('results'):
                        return parsed
        except Exception as e:
            logger.warning(f"YouTube yt-dlp fallback error: {e}")

        return None

    # =========================================================================
    # 2. TIKTOK EXTRACTOR
    # =========================================================================
    def _extract_tiktok(self, url: str) -> Optional[Dict[str, Any]]:
        # Tier 1: SSSTik High-Speed Unwatermarked Extractor
        try:
            s_ss = requests.Session()
            r_ss = s_ss.get('https://ssstik.io/en', headers={'User-Agent': USER_AGENT}, timeout=5)
            m_tt = re.search(r"s_tt\s*=\s*['\"]([^'\"]+)['\"]|tt:\s*['\"]([^'\"]+)['\"]|data-tt=[\"']([^\"']+)[\"']", r_ss.text)
            tt_val = (m_tt.group(1) or m_tt.group(2) or m_tt.group(3)) if m_tt else 'YW1icm9zaWE='
            r_post = s_ss.post('https://ssstik.io/abc?url=dl', data={'id': url, 'locale': 'en', 'tt': tt_val}, headers={'User-Agent': USER_AGENT, 'Referer': 'https://ssstik.io/en'}, timeout=7)
            if r_post.status_code == 200:
                html = r_post.text
                tm = re.search(r'<h2>([^<]+)</h2>|<p class="maintext">([^<]+)</p>', html)
                title = (tm.group(1) or tm.group(2)).strip() if tm else "TikTok Video Without Watermark"
                im = re.search(r'<img[^>]+src="([^"]+)"', html)
                thumb = im.group(1) if im else ""

                results = []
                seen_urls = set()

                # Robust <a> tag extraction handling nested SVG and SPAN tags inside the anchor
                for a_match in re.finditer(r'<a\s+([^>]+)>(.*?)</a>', html, re.DOTALL):
                    attrs = a_match.group(1)
                    inner = a_match.group(2)

                    href_m = re.search(r'href=["\']([^"\']+)["\']', attrs)
                    if not href_m:
                        continue
                    href = href_m.group(1).strip()
                    if not href.startswith('http') or href in seen_urls:
                        continue

                    clean_text = re.sub(r'<[^>]+>', ' ', inner).strip().lower()
                    if any(k in clean_text for k in ['without watermark', 'download', 'direct', 'mp3']) or 'download_link' in attrs:
                        is_mp3 = 'mp3' in clean_text or 'music' in attrs.lower()
                        seen_urls.add(href)

                        if not is_mp3:
                            results.append({
                                "url": href,
                                "type": "video",
                                "quality": "HD (No Watermark)",
                                "format": "mp4",
                                "has_audio": True,
                                "size": "Original HD Stream",
                                "thumbnail": thumb
                            })
                        else:
                            results.append({
                                "url": href,
                                "type": "audio",
                                "quality": "Original Audio (MP3)",
                                "format": "mp3",
                                "has_audio": True,
                                "size": "Audio Stream",
                                "thumbnail": thumb
                            })
                            # Direct 1080p unwatermarked video stream encoded inside SSSTik MP3 base64 /m/ link
                            if '/m/' in href:
                                try:
                                    b64_part = href.split('/m/')[1]
                                    b64_part += '=' * (-len(b64_part) % 4)
                                    direct_url = base64.b64decode(b64_part).decode('utf-8', errors='ignore')
                                    if direct_url.startswith('http') and direct_url not in seen_urls:
                                        seen_urls.add(direct_url)
                                        results.insert(0, {
                                            "url": direct_url,
                                            "type": "video",
                                            "quality": "1080p Full HD",
                                            "format": "mp4",
                                            "has_audio": True,
                                            "size": "High Speed HD",
                                            "thumbnail": thumb
                                        })
                                except Exception:
                                    pass

                if thumb and thumb not in seen_urls:
                    results.append({
                        "url": thumb,
                        "type": "photo",
                        "quality": "Cover Photo",
                        "format": "jpg",
                        "has_audio": False,
                        "size": "Original JPG",
                        "thumbnail": thumb
                    })

                if results:
                    return {
                        "status": "success",
                        "title": title[:100],
                        "thumbnail": thumb,
                        "type": results[0]["type"],
                        "download": results[0]["url"],
                        "author": "TikTok Creator",
                        "duration": "",
                        "platform": "tiktok",
                        "results": results
                    }
        except Exception as e:
            logger.warning(f"TikTok SSSTik error: {e}")

        # Tier 2: Hostinger Grapweb TikTok POST API (High Speed, Unwatermarked)
        try:
            r = requests.post("https://grapweb.com/tiktok/api.php", data={"url": url}, timeout=5, headers={'User-Agent': USER_AGENT})
            if r.status_code == 200:
                d = r.json()
                if d.get("status") == "success" and d.get("medias"):
                    title = d.get("title") or "TikTok Video Without Watermark"
                    thumb = d.get("thumbnail") or ""
                    author_obj = d.get("author") or {}
                    author = author_obj.get("name") or author_obj.get("username") or "TikTok Creator"
                    results = []

                    for m in d["medias"]:
                        m_url = m.get("url")
                        if not m_url:
                            continue
                        q = m.get("quality") or "HD No Watermark"
                        fmt = (m.get("format") or "mp4").lower()
                        is_aud = (fmt == "mp3" or "audio" in q.lower())
                        results.append({
                            "url": m_url,
                            "type": "audio" if is_aud else "video",
                            "quality": q,
                            "format": fmt,
                            "has_audio": True,
                            "size": "Original Stream",
                            "thumbnail": thumb
                        })

                    if thumb:
                        results.append({
                            "url": thumb,
                            "type": "photo",
                            "quality": "Cover Photo (JPG)",
                            "format": "jpg",
                            "size": "Original JPG",
                            "thumbnail": thumb
                        })

                    if results:
                        return {
                            "status": "success",
                            "title": title[:100],
                            "thumbnail": thumb,
                            "type": results[0]["type"],
                            "download": results[0]["url"],
                            "author": author,
                            "duration": "",
                            "platform": "tiktok",
                            "results": results
                        }
        except Exception as e:
            logger.warning(f"TikTok Grapweb error: {e}")

        # Tier 2: TikWM API
        try:
            twm_res = requests.get(f"https://www.tikwm.com/api/?url={urllib.parse.quote(url)}", timeout=4, headers={'User-Agent': USER_AGENT})
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
                            "has_audio": True,
                            "size": human_filesize(d.get('size')),
                            "thumbnail": cover
                        })
                    if play_url:
                        results.append({
                            "url": play_url,
                            "type": "video",
                            "quality": "HD Video (No Watermark)",
                            "format": "mp4",
                            "has_audio": True,
                            "size": human_filesize(d.get('size')),
                            "thumbnail": cover
                        })
                    if music:
                        results.append({
                            "url": music,
                            "type": "audio",
                            "quality": "Original Audio (MP3)",
                            "format": "mp3",
                            "has_audio": True,
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
            logger.warning(f"TikTok TikWM error: {e}")

        # Tier 3: yt-dlp
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts_base) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    parsed = self._parse_info(info, 'tiktok', url)
                    if parsed and parsed.get('results'):
                        return parsed
        except Exception as e:
            logger.warning(f"TikTok yt-dlp error: {e}")

        return None

    # =========================================================================
    # 3. INSTAGRAM EXTRACTOR
    # =========================================================================
    def _extract_instagram(self, url: str) -> Optional[Dict[str, Any]]:
        # Tier 1: SaveInsta Token + SaveVids Ajax + Hunter Unpacker Decoder
        try:
            session = requests.Session()
            r_page = session.get('https://saveinsta.io', headers={'User-Agent': USER_AGENT}, timeout=4)
            exp_m = re.search(r'k_exp\s*=\s*["\'](\d+)["\']', r_page.text)
            token_m = re.search(r'k_token\s*=\s*["\']([a-f0-9]+)["\']', r_page.text)
            if exp_m and token_m:
                k_exp = exp_m.group(1)
                k_token = token_m.group(1)
                payload = {'k_exp': k_exp, 'k_token': k_token, 'q': url, 't': 'media', 'lang': 'en', 'v': 'v2'}
                api_headers = {
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': 'https://saveinsta.io',
                    'Referer': 'https://saveinsta.io/',
                    'X-Requested-With': 'XMLHttpRequest'
                }
                res = session.post('https://savevids.to/api/ajaxSearch', data=payload, headers=api_headers, timeout=6)
                if res.status_code == 200:
                    j = res.json()
                    html = j.get('data', '')
                    if html:
                        m = re.search(r'}\s*\(\s*"([^"]+)"\s*,\s*(\d+|"[^"]*")\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,', html)
                        decoded = decode_hunter(m.group(1), m.group(3), int(m.group(4)), int(m.group(5))) if m else html

                        cand_links = []
                        for m_link in re.finditer(r'<a[^>]+href=\\?"([^"\\]+)\\?"[^>]*title=\\?"([^"\\]*)\\?"', decoded):
                            cand_links.append((m_link.group(1), m_link.group(2)))
                        if not cand_links:
                            for u in re.findall(r'href=\\?"([^"\\]+)\\?"', decoded):
                                cand_links.append((u, ""))

                        img_urls = re.findall(r'src=\\?"([^"\\]+)\\?"', decoded)
                        raw_thumb = img_urls[0] if img_urls else ""
                        thumb = unpack_token_url(raw_thumb)

                        videos = []
                        photos = []

                        for u, title in cand_links:
                            if not u.startswith("http"):
                                continue
                            clean_u = unpack_token_url(u)
                            is_v = (".mp4" in clean_u.lower() or "video" in clean_u.lower() or 
                                    "video" in title.lower() or "/o1/v/" in clean_u)
                            is_thumb_or_photo = ("photo" in title.lower() or "thumb" in title.lower() or 
                                                 ".jpg" in clean_u.lower() or ".jpeg" in clean_u.lower() or 
                                                 ".png" in clean_u.lower() or ".webp" in clean_u.lower() or
                                                 "/v/t51." in clean_u)

                            if is_v and not is_thumb_or_photo:
                                if clean_u not in videos:
                                    videos.append(clean_u)
                            else:
                                if clean_u not in photos and clean_u != thumb:
                                    photos.append(clean_u)

                        results = []
                        for idx, v in enumerate(videos):
                            results.append({
                                "url": v,
                                "type": "video",
                                "quality": f"{1080 if idx == 0 else 720}p Full HD" if idx == 0 else "720p HD",
                                "format": "mp4",
                                "has_audio": True,
                                "size": "HD MP4",
                                "thumbnail": thumb
                            })

                        for idx, p in enumerate(photos):
                            results.append({
                                "url": p,
                                "type": "photo",
                                "quality": f"Photo #{idx+1}",
                                "format": "jpg",
                                "size": "Original JPG",
                                "thumbnail": p
                            })

                        if thumb and not photos:
                            results.append({
                                "url": thumb,
                                "type": "photo",
                                "quality": "Cover Image",
                                "format": "jpg",
                                "size": "Original JPG",
                                "thumbnail": thumb
                            })

                        if results:
                            return {
                                "status": "success",
                                "title": "Instagram Media",
                                "thumbnail": thumb,
                                "type": results[0]["type"],
                                "download": results[0]["url"],
                                "author": "Instagram Creator",
                                "duration": "",
                                "platform": "instagram",
                                "results": results
                            }
        except Exception as e:
            logger.warning(f"Instagram SaveInsta error: {e}")

        # Tier 2: Hostinger Grapweb Instagram API
        try:
            r = requests.post("https://grapweb.com/instagram/api.php", data={"url": url}, timeout=5, headers={'User-Agent': USER_AGENT})
            if r.status_code == 200:
                d = r.json()
                if d.get("status") == "success" and d.get("medias"):
                    results = []
                    thumb = unpack_token_url(d.get("thumbnail") or "")
                    for m in d["medias"]:
                        target = unpack_token_url(m.get("url"))
                        if not target:
                            continue
                        is_v = m.get("type") == "video" or "mp4" in (m.get("format") or "").lower()
                        results.append({
                            "url": target,
                            "type": "video" if is_v else "photo",
                            "quality": m.get("quality") or ("1080p Full HD" if is_v else "Original Image"),
                            "format": m.get("format") or ("mp4" if is_v else "jpg"),
                            "has_audio": is_v,
                            "size": "Source Stream",
                            "thumbnail": thumb
                        })
                    if results:
                        return {
                            "status": "success",
                            "title": d.get("title") or "Instagram Media",
                            "thumbnail": thumb,
                            "type": results[0]["type"],
                            "download": results[0]["url"],
                            "author": "Instagram Creator",
                            "duration": "",
                            "platform": "instagram",
                            "results": results
                        }
        except Exception as e:
            logger.warning(f"Instagram Grapweb error: {e}")

        # Tier 3: yt-dlp with mobile iOS client headers
        try:
            ydl_opts = dict(self.ydl_opts_base)
            ydl_opts['http_headers'] = {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'X-IG-App-ID': '936619743392459',
                'Referer': 'https://www.instagram.com/'
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    parsed = self._parse_info(info, 'instagram', url)
                    if parsed and parsed.get('results'):
                        return parsed
        except Exception as e:
            logger.warning(f"Instagram yt-dlp error: {e}")

        return None

    # =========================================================================
    # 4. FACEBOOK EXTRACTOR
    # =========================================================================
    def _extract_facebook(self, url: str) -> Optional[Dict[str, Any]]:
        # Tier 1: Hostinger Grapweb Facebook API
        try:
            r = requests.post("https://grapweb.com/facebook/api.php", data={"url": url}, timeout=5, headers={'User-Agent': USER_AGENT})
            if r.status_code == 200:
                d = r.json()
                if d.get("status") == "success" and d.get("medias"):
                    results = []
                    thumb = unpack_token_url(d.get("thumbnail") or "")
                    title = d.get("title") or "Facebook Video"
                    for m in d["medias"]:
                        target = unpack_token_url(m.get("url"))
                        if not target:
                            continue
                        q = m.get("quality") or "HD Video"
                        results.append({
                            "url": target,
                            "type": "video",
                            "quality": f"{q} (MP4)",
                            "format": "mp4",
                            "has_audio": True,
                            "size": "HD Stream",
                            "thumbnail": thumb
                        })
                    if thumb:
                        results.append({
                            "url": thumb,
                            "type": "photo",
                            "quality": "Cover Photo (JPG)",
                            "format": "jpg",
                            "size": "Original JPG",
                            "thumbnail": thumb
                        })
                    if results:
                        return {
                            "status": "success",
                            "title": title,
                            "thumbnail": thumb,
                            "type": "video",
                            "download": results[0]["url"],
                            "author": "Facebook Creator",
                            "duration": "",
                            "platform": "facebook",
                            "results": results
                        }
        except Exception as e:
            logger.warning(f"Facebook Grapweb error: {e}")

        # Tier 2: Direct HTML Scraping for playable URLs
        try:
            r = requests.get(url, headers={'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9'}, timeout=5)
            text = r.text.replace(r'\/', '/')
            sd = re.findall(r'"browser_native_sd_url":"([^"]+)"', text) or re.findall(r'"playable_url":"([^"]+)"', text)
            hd = re.findall(r'"browser_native_hd_url":"([^"]+)"', text) or re.findall(r'"playable_url_quality_hd":"([^"]+)"', text)
            thumb_m = re.findall(r'"preferred_thumbnail":\{"image":\{"uri":"([^"]+)"', text) or re.findall(r'property="og:image" content="([^"]+)"', text)
            title_m = re.findall(r'<title>([^<]+)</title>', text)

            results = []
            thumb = thumb_m[0] if thumb_m else ""
            title = title_m[0] if title_m else "Facebook Video"

            if hd:
                results.append({
                    "url": hd[0],
                    "type": "video",
                    "quality": "720p HD",
                    "format": "mp4",
                    "has_audio": True,
                    "size": "HD MP4",
                    "thumbnail": thumb
                })
            if sd and (not hd or sd[0] != hd[0]):
                results.append({
                    "url": sd[0],
                    "type": "video",
                    "quality": "360p SD",
                    "format": "mp4",
                    "has_audio": True,
                    "size": "SD MP4",
                    "thumbnail": thumb
                })
            if thumb:
                results.append({
                    "url": thumb,
                    "type": "photo",
                    "quality": "Cover Photo",
                    "format": "jpg",
                    "size": "Original JPG",
                    "thumbnail": thumb
                })
            if results:
                return {
                    "status": "success",
                    "title": title,
                    "thumbnail": thumb,
                    "type": "video",
                    "download": results[0]["url"],
                    "author": "Facebook Creator",
                    "duration": "",
                    "platform": "facebook",
                    "results": results
                }
        except Exception as e:
            logger.warning(f"Facebook HTML scraping error: {e}")

        # Tier 3: yt-dlp
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts_base) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    parsed = self._parse_info(info, 'facebook', url)
                    if parsed and parsed.get('results'):
                        return parsed
        except Exception as e:
            logger.warning(f"Facebook yt-dlp error: {e}")

        return None

    # =========================================================================
    # 5. PINTEREST EXTRACTOR
    # =========================================================================
    def _extract_pinterest(self, url: str) -> Optional[Dict[str, Any]]:
        # Tier 1: Direct HTML Regex Scraping (HLS to MP4, Direct MP4, /originals/ High-Res)
        try:
            r = requests.get(url, headers={'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9'}, timeout=7, allow_redirects=True)
            html = r.text.replace('\\/', '/')

            # Title extraction with fallback to og:title
            title_m = re.findall(r'<title>([^<]+)</title>', html)
            title = title_m[0].split('|')[0].strip() if title_m else ""
            if not title or title.lower() == "pinterest":
                og_t = re.search(r'<meta[^>]+(?:property|name)=["\'](?:og:)?title["\'][^>]+content=["\']([^"\']+)["\']', html)
                if og_t:
                    title = og_t.group(1).split('|')[0].strip()
            if not title:
                title = "Pinterest Media"

            results = []
            seen_urls = set()

            # 1. Look for direct MP4 videos in page content / JSON
            mp4s = re.findall(r'https?://v[0-9]?\.pinimg\.com/videos/[^\s"\'<>\\]+\.mp4[^\s"\'<>\\]*', html)
            for m in mp4s:
                clean_m = m.split('&amp;')[0]
                if clean_m not in seen_urls:
                    seen_urls.add(clean_m)
                    results.append({
                        "url": clean_m,
                        "type": "video",
                        "quality": "1080p / 720p HD Video",
                        "format": "mp4",
                        "has_audio": True,
                        "size": "HD MP4",
                        "thumbnail": ""
                    })

            # 2. Look for HLS m3u8 streams and convert to progressive 720p MP4
            m3u8s = re.findall(r'https?://v[0-9]?\.pinimg\.com/videos/[^\s"\'<>\\]+\.m3u8[^\s"\'<>\\]*', html)
            for m in m3u8s:
                # Progressive conversion formula for Pinterest HLS
                conv_mp4 = re.sub(r'/hls/', '/720p/', m)
                conv_mp4 = re.sub(r'master\.m3u8.*', 'video.mp4', conv_mp4)
                conv_mp4 = re.sub(r'\.m3u8.*', '.mp4', conv_mp4)
                if conv_mp4 not in seen_urls:
                    seen_urls.add(conv_mp4)
                    results.append({
                        "url": conv_mp4,
                        "type": "video",
                        "quality": "HD Video (MP4)",
                        "format": "mp4",
                        "has_audio": True,
                        "size": "720p MP4",
                        "thumbnail": ""
                    })

            # 3. Look for cover / high-res images
            thumb = ""
            og_img = re.search(r'<meta[^>]+(?:property|name)=["\'](?:og:)?image["\'][^>]+content=["\']([^"\']+)["\']', html)
            if og_img and og_img.group(1).startswith('http'):
                thumb = og_img.group(1)

            imgs = re.findall(r'https?://i\.pinimg\.com/[0-9a-zA-Z_/-]+/[a-f0-9]{32}\.(?:jpg|png|webp)', html)
            for img in imgs:
                orig_img = re.sub(r'https?://i\.pinimg\.com/[^/]+/', 'https://i.pinimg.com/originals/', img)
                if not thumb:
                    thumb = orig_img
                if orig_img not in seen_urls:
                    seen_urls.add(orig_img)
                    ext = orig_img.split('.')[-1].lower()
                    results.append({
                        "url": orig_img,
                        "type": "photo",
                        "quality": f"Original High-Res ({ext.upper()})",
                        "format": ext,
                        "has_audio": False,
                        "size": "Original Resolution",
                        "thumbnail": orig_img
                    })
                if len(results) >= 5:
                    break

            if results:
                if thumb:
                    for item in results:
                        if not item.get('thumbnail'):
                            item['thumbnail'] = thumb

                return {
                    "status": "success",
                    "title": title,
                    "thumbnail": thumb,
                    "type": results[0]["type"],
                    "download": results[0]["url"],
                    "author": "Pinterest Creator",
                    "duration": "",
                    "platform": "pinterest",
                    "results": results
                }
        except Exception as e:
            logger.warning(f"Pinterest HTML scraping error: {e}")

        # Tier 2: yt-dlp
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts_base) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    parsed = self._parse_info(info, 'pinterest', url)
                    if parsed and parsed.get('results'):
                        return parsed
        except Exception as e:
            logger.warning(f"Pinterest yt-dlp error: {e}")

        return None

    # =========================================================================
    # 6. TWITTER / X EXTRACTOR
    # =========================================================================
    def _extract_twitter(self, url: str) -> Optional[Dict[str, Any]]:
        m = re.search(r'status/(\d+)', url)
        if not m:
            return None
        tweet_id = m.group(1)

        # Tier 1: FxTwitter TelegramBot OpenGraph Engine (Instant 720p/1080p MP4 + High-Res Photos)
        try:
            r_fx = requests.get(
                f"https://fxtwitter.com/i/status/{tweet_id}",
                headers={'User-Agent': 'TelegramBot (like TwitterBot)'},
                timeout=5
            )
            if r_fx.status_code == 200:
                html = r_fx.text
                desc_m = re.search(r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"', html)
                desc = desc_m.group(1).strip() if desc_m else ""
                title_m = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', html)
                title = title_m.group(1).strip() if title_m else "Twitter / X Post"

                if "post doesn't exist" not in desc and "Post Not Found" not in desc:
                    if desc and len(desc) > len(title):
                        title = desc

                    img_m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html)
                    thumb = img_m.group(1) if img_m else ""

                    results = []
                    # Extract direct video URLs
                    for vm in re.finditer(r'<meta[^>]+property="og:video(?::secure_url)?"[^>]+content="([^"]+)"', html):
                        v_raw = vm.group(1)
                        v_final = v_raw
                        if 'url=' in v_raw:
                            v_final = urllib.parse.unquote(v_raw.split('url=')[1])
                        if v_final.startswith('http') and v_final not in [res['url'] for res in results]:
                            results.append({
                                "url": v_final,
                                "type": "video",
                                "quality": "HD Video (MP4)",
                                "format": "mp4",
                                "has_audio": True,
                                "size": "Direct Stream",
                                "thumbnail": thumb
                            })

                    # Extract photo
                    if thumb and "default-og.jpg" not in thumb and thumb not in [res['url'] for res in results]:
                        results.append({
                            "url": thumb,
                            "type": "photo",
                            "quality": "HD Photo",
                            "format": "jpg",
                            "has_audio": False,
                            "size": "Original Resolution",
                            "thumbnail": thumb
                        })

                    if results:
                        return {
                            "status": "success",
                            "title": title[:100],
                            "thumbnail": thumb,
                            "type": results[0]["type"],
                            "download": results[0]["url"],
                            "author": "Twitter User",
                            "duration": "",
                            "platform": "twitter",
                            "results": results
                        }
        except Exception as e:
            logger.warning(f"Twitter FxTwitter error: {e}")

        # Tier 2: TwitSave Info Parser
        try:
            r = requests.get(f"https://twitsave.com/info?url=https://twitter.com/i/status/{tweet_id}", headers={'User-Agent': USER_AGENT}, timeout=5)
            if r.status_code == 200:
                dls = re.findall(r'href="([^"]+)"', r.text)
                video_links = [l for l in dls if "twitsave.com/download" in l or "video.twimg.com" in l or ".mp4" in l]
                thumbs = re.findall(r'<img[^>]+src="([^"]+)"', r.text)
                tw_thumbs = [t for t in thumbs if "twimg.com" in t or "media" in t]
                title_m = re.search(r'<p class="[^"]*text-white[^"]*"[^>]*>([\s\S]*?)</p>', r.text)
                title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip() if title_m else f"Twitter Post {tweet_id}"
                thumb = tw_thumbs[0] if tw_thumbs else ""

                if video_links:
                    results = []
                    for idx, vl in enumerate(video_links):
                        results.append({
                            "url": vl,
                            "type": "video",
                            "quality": f"{1080 if idx == 0 else (720 if idx == 1 else 480)}p HD Video",
                            "format": "mp4",
                            "has_audio": True,
                            "size": "Direct Stream",
                            "thumbnail": thumb
                        })
                    if thumb:
                        results.append({
                            "url": thumb,
                            "type": "photo",
                            "quality": "Cover Photo",
                            "format": "jpg",
                            "size": "Original JPG",
                            "thumbnail": thumb
                        })
                    return {
                        "status": "success",
                        "title": title[:100],
                        "thumbnail": thumb,
                        "type": "video",
                        "download": results[0]["url"],
                        "author": "Twitter User",
                        "duration": "",
                        "platform": "twitter",
                        "results": results
                    }
        except Exception as e:
            logger.warning(f"Twitter TwitSave error: {e}")

        # Tier 2: FxTwitter API
        try:
            r = requests.get(f"https://api.fxtwitter.com/i/status/{tweet_id}", headers={'User-Agent': USER_AGENT}, timeout=4)
            if r.status_code == 200:
                data = r.json().get('tweet', {})
                media = data.get('media', {})
                videos = media.get('videos', [])
                photos = media.get('photos', [])
                results = []
                thumb = data.get('thumbnail') or ""

                for v in videos:
                    v_url = v.get('url')
                    if v_url:
                        results.append({
                            "url": v_url,
                            "type": "video",
                            "quality": "HD Video",
                            "format": "mp4",
                            "has_audio": True,
                            "size": "Direct Stream",
                            "thumbnail": v.get('thumbnail_url') or thumb
                        })

                for p in photos:
                    p_url = p.get('url')
                    if p_url:
                        results.append({
                            "url": p_url,
                            "type": "photo",
                            "quality": "HD Photo",
                            "format": "jpg",
                            "size": "Direct Image",
                            "thumbnail": p_url
                        })

                if results:
                    return {
                        "status": "success",
                        "title": data.get('text', f"Twitter Post {tweet_id}")[:80],
                        "thumbnail": results[0].get('thumbnail') or thumb,
                        "type": results[0]['type'],
                        "download": results[0]['url'],
                        "author": data.get('author', {}).get('name', 'Twitter User'),
                        "duration": "",
                        "platform": "twitter",
                        "results": results
                    }
        except Exception as e:
            logger.warning(f"Twitter FxTwitter error: {e}")

        # Tier 3: yt-dlp
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts_base) as ydl:
                info = ydl.extract_info(url, download=False)
                if info:
                    parsed = self._parse_info(info, 'twitter', url)
                    if parsed and parsed.get('results'):
                        return parsed
        except Exception as e:
            logger.warning(f"Twitter yt-dlp error: {e}")

        return None

    # =========================================================================
    # 7. OPENGRAPH SCRAPER FALLBACK
    # =========================================================================
    def _extract_opengraph(self, url: str, platform: str) -> Optional[Dict[str, Any]]:
        try:
            resp = requests.get(url, timeout=5, headers={
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            })
            html = resp.text

            og_title = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html)
            og_video = re.search(r'<meta[^>]+property=["\']og:video(?:[:_]url)?["\'][^>]+content=["\']([^"\']+)["\']', html)
            og_image = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)

            title = og_title.group(1) if og_title else f"{platform.capitalize()} Extracted Media"
            video_url = og_video.group(1) if og_video else None
            image_url = og_image.group(1) if og_image else None

            # Filter out 404 error pages or default placeholder images
            if any(k in title.lower() for k in ["404 error", "post not found", "page not found"]):
                return None
            if image_url and "default-og.jpg" in image_url:
                return None
            if video_url and "youtube.com/embed" in video_url:
                video_url = None

            # Never return photo-only results for YouTube (the user wants a video)
            if platform == 'youtube' and not video_url:
                return None

            results = []
            if video_url and video_url.startswith('http'):
                results.append({
                    "url": video_url,
                    "type": "video",
                    "quality": "HD MP4",
                    "format": "mp4",
                    "has_audio": True,
                    "size": "Source Stream",
                    "thumbnail": image_url or ""
                })
            if image_url and image_url.startswith('http'):
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
        except Exception as e:
            logger.debug(f"OpenGraph scraper error: {e}")

        return None

    # =========================================================================
    # 8. YT-DLP INFO PARSER (Helper)
    # =========================================================================
    def _parse_info(self, info: Dict[str, Any], platform: str, url: str) -> Dict[str, Any]:
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
        seen_urls = set()

        max_height = 0
        for f in formats:
            h = f.get('height') or 0
            if h > max_height:
                max_height = h
        if max_height <= 0:
            max_height = 1080

        for f in formats:
            stream_url = f.get('url')
            if not stream_url or stream_url in seen_urls:
                continue
            seen_urls.add(stream_url)

            ext = f.get('ext') or 'mp4'
            height = f.get('height') or 0
            size_bytes = f.get('filesize') or f.get('filesize_approx')
            vcodec = f.get('vcodec')
            acodec = f.get('acodec')
            format_note = str(f.get('format_note') or '').lower()
            format_id = str(f.get('format_id') or '')

            is_audio_only = (vcodec == 'none' and acodec not in [None, 'none']) or ('audio only' in format_note) or (f.get('resolution') == 'audio only')
            is_video_only = (acodec == 'none' and vcodec not in [None, 'none']) or ('dash video' in format_note)

            is_combined = False
            if not is_audio_only and not is_video_only:
                if vcodec not in [None, 'none'] and acodec not in [None, 'none']:
                    is_combined = True
                elif ext == 'mp4' and 'dash' not in format_note:
                    is_combined = True
                elif format_id.isdigit() and ext == 'mp4':
                    is_combined = True

            if is_audio_only:
                raw_abr = f.get('abr')
                abr_val = int(raw_abr) if raw_abr else 128
                size_label = human_filesize(size_bytes) if (size_bytes and size_bytes > 0) else estimate_stream_size(0, duration_sec, is_audio=True, abr=abr_val)
                audio_streams.append({
                    "url": stream_url,
                    "type": "audio",
                    "quality": f"{abr_val}kbps Audio (MP3)",
                    "has_audio": True,
                    "abr": abr_val,
                    "format": "mp3" if ext in ['mp3', 'm4a', 'aac'] else ext,
                    "size": size_label,
                    "thumbnail": thumbnail
                })
            elif is_combined:
                eff_h = height if height > 0 else max_height
                size_label = human_filesize(size_bytes) if (size_bytes and size_bytes > 0) else estimate_stream_size(eff_h, duration_sec, is_audio=False)
                if eff_h >= 1080:
                    label = f"{eff_h}p Full HD"
                elif eff_h >= 720:
                    label = f"{eff_h}p HD"
                else:
                    label = f"{eff_h}p"
                combined_videos.append({
                    "url": stream_url,
                    "type": "video",
                    "quality": label,
                    "has_audio": True,
                    "height": eff_h,
                    "format": ext,
                    "size": size_label,
                    "thumbnail": thumbnail
                })
            elif is_video_only:
                eff_h = height if height > 0 else 720
                size_label = human_filesize(size_bytes) if (size_bytes and size_bytes > 0) else estimate_stream_size(eff_h, duration_sec, is_audio=False)
                video_only.append({
                    "url": stream_url,
                    "type": "video",
                    "quality": f"{eff_h}p Video Stream",
                    "has_audio": False,
                    "height": eff_h,
                    "format": ext,
                    "size": size_label,
                    "thumbnail": thumbnail
                })

        combined_videos.sort(key=lambda x: x.get('height', 0), reverse=True)
        seen_h = set()
        for v in combined_videos:
            h = v.get('height', 0)
            if h not in seen_h:
                seen_h.add(h)
                results.append(v)

        if len(results) == 1 and results[0].get('height', 0) >= 1080:
            top_v = results[0]
            results.append({
                "url": top_v['url'],
                "type": "video",
                "quality": "720p HD",
                "has_audio": True,
                "height": 720,
                "format": top_v['format'],
                "size": estimate_stream_size(720, duration_sec),
                "thumbnail": thumbnail
            })

        if not results and video_only:
            video_only.sort(key=lambda x: x.get('height', 0), reverse=True)
            for v in video_only:
                h = v.get('height', 0)
                if h not in seen_h:
                    seen_h.add(h)
                    results.append(v)
                if len(results) >= 2:
                    break

        audio_streams.sort(key=lambda x: x.get('abr', 0), reverse=True)
        seen_abr = set()
        for a in audio_streams:
            abr = a.get('abr', 0)
            if abr not in seen_abr:
                seen_abr.add(abr)
                results.append(a)
            if len(seen_abr) >= 1:
                break

        if not any(r.get('type') == 'audio' for r in results) and results:
            results.append({
                "url": results[0]['url'],
                "type": "audio",
                "quality": "High Audio (MP3)",
                "has_audio": True,
                "format": "mp3",
                "size": estimate_stream_size(0, duration_sec, is_audio=True, abr=192),
                "thumbnail": thumbnail
            })

        if not results and info.get('url'):
            results.append({
                "url": info.get('url'),
                "type": "video",
                "quality": "1080p Full HD",
                "has_audio": True,
                "format": info.get('ext') or "mp4",
                "size": human_filesize(info.get('filesize')),
                "thumbnail": thumbnail
            })

        if thumbnail:
            results.append({
                "url": thumbnail,
                "type": "photo",
                "quality": "HD Cover Poster",
                "has_audio": False,
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
                "has_audio": (media_type == 'video'),
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

# Global extractor singleton
extractor = MediaExtractor()
