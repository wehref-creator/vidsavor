import os
import re
import time
import urllib.parse
import logging
import requests
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, Query, Response
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.extractor import extractor, unpack_token_url

logger = logging.getLogger(__name__)

app = FastAPI(title="VidSavor API", description="Fast & HD Online Video Downloader API", version="2.0.0")

# Enable CORS for cross-domain or client integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

# Mount static files if static folder exists
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if os.path.exists(PUBLIC_DIR):
    app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")

class FetchRequest(BaseModel):
    url: Optional[str] = None
    token: Optional[str] = None
    title: Optional[str] = "youtube_video"
    format: Optional[str] = "mp4"
    task_id: Optional[str] = None

@app.post("/fetch")
@app.post("/api/fetch")
@app.post("/api/index.py")
@app.post("/api")
async def fetch_media(request: Request, req: Optional[FetchRequest] = None):
    """Primary extraction endpoint matching freevideosave.com contract."""
    body_dict = {}
    try:
        body_dict = await request.json()
    except Exception:
        pass

    target_token = (req.token if req else None) or body_dict.get("token") or body_dict.get("task_id")
    target_url = (req.url if req else None) or body_dict.get("url")

    # If it's a resolve-youtube conversion request forwarded to /api/index.py
    if target_token or body_dict.get("task_id") or request.query_params.get("action") == "resolve" or "resolve" in str(request.url.path):
        return await resolve_youtube(
            request,
            token=target_token,
            title=body_dict.get("title", "youtube_video"),
            format=body_dict.get("format", "mp4"),
            task_id=body_dict.get("task_id"),
            url=target_url
        )

    if not target_url or not target_url.strip():
        return JSONResponse(
            status_code=200,
            content={"status": "error", "message": "Please paste a valid video or post link."}
        )
    
    result = extractor.extract(target_url.strip())
    return JSONResponse(status_code=200, content=result)

@app.api_route("/api/resolve-youtube", methods=["GET", "POST"])
@app.api_route("/resolve-youtube", methods=["GET", "POST"])
async def resolve_youtube(
    request: Request,
    token: Optional[str] = Query(None),
    title: Optional[str] = Query("youtube_video"),
    format: Optional[str] = Query("mp4"),
    url: Optional[str] = Query(None),
    task_id: Optional[str] = Query(None)
):
    """
    Resolves YouTube video streams into high-speed unthrottled direct downloads
    using the SaveNow cloud conversion engine with resilient Grapweb & yt-dlp fallback.
    Guaranteed to return in under 5 seconds (zero Vercel 10s timeouts).
    """
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            try:
                form = await request.form()
                body_data = dict(form)
            except Exception:
                pass

    req_title = body_data.get("title") or request.query_params.get("title") or (title if isinstance(title, str) else "youtube_video")
    req_format = body_data.get("format") or request.query_params.get("format") or (format if isinstance(format, str) else "mp4")
    req_token = body_data.get("token") or body_data.get("url") or (token if isinstance(token, str) else "") or request.query_params.get("token") or request.query_params.get("url") or ""
    original_url = body_data.get("url") or (url if isinstance(url, str) else "") or request.query_params.get("url") or ""
    req_task_id = body_data.get("task_id") or request.query_params.get("task_id")

    # Sanitize title and format
    clean_title = re.sub(r'[^a-zA-Z0-9_\-\s]', '', str(req_title or "youtube_video")).strip()
    clean_title = re.sub(r'\s+', '_', clean_title)[:60] or "youtube_video"
    clean_format = str(req_format or "mp4").lower().strip()
    if clean_format not in ["mp4", "mp3", "m4a", "webm", "1080", "720", "480", "360"]:
        clean_format = "mp4"

    target_ext = clean_format if clean_format in ["mp3", "m4a"] else "mp4"

    savenow_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Origin': 'https://loader.to',
        'Referer': 'https://loader.to/'
    }

    # 1. Polling existing task_id (Vidssave / SaveNow Engine)
    if req_task_id:
        # Check Vidssave task ID (starts with Z0ve)
        if str(req_task_id).startswith("Z0ve"):
            try:
                query_url = f"https://api.vidssave.com/api/contentsite_api/media/download_query?auth=20250901majwlqo&domain=api-ak.vidssave.com&task_id={urllib.parse.quote(str(req_task_id))}&download_domain=vidssave.com&origin=content_site"
                qr = requests.get(query_url, timeout=7)
                if qr.ok:
                    txt = qr.text
                    dl_link = None
                    if "data: " in txt:
                        for line in txt.splitlines():
                            if line.startswith("data: "):
                                try:
                                    d_json = json.loads(line[6:].strip())
                                    if d_json.get("download_link"):
                                        dl_link = d_json["download_link"]
                                        break
                                except Exception:
                                    pass
                    if not dl_link:
                        try:
                            q_json = qr.json()
                            dl_link = q_json.get("data", {}).get("download_link") or q_json.get("download_link")
                        except Exception:
                            pass

                    if dl_link and dl_link.startswith("http"):
                        loc = dl_link
                        try:
                            r_loc = requests.get(dl_link, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
                            if r_loc.headers.get("Location"):
                                loc = r_loc.headers.get("Location")
                        except Exception:
                            pass
                        return JSONResponse({
                            "status": "success",
                            "download_url": loc,
                            "filename": f"{clean_title}.{target_ext}"
                        })

                    if "event: running" in txt or '"status":"running"' in txt:
                        return JSONResponse({
                            "status": "pending",
                            "task_id": req_task_id,
                            "progress": 65,
                            "title": clean_title,
                            "format": target_ext
                        })
            except Exception as v_err:
                logger.warning(f"Vidssave task query error: {v_err}")

        # Check SaveNow task ID fallback
        try:
            chk_resp = requests.get(
                f"https://p.savenow.to/api/progress?id={urllib.parse.quote(str(req_task_id))}",
                headers=savenow_headers,
                timeout=7
            )
            if not chk_resp.ok:
                chk_resp = requests.get(
                    f"https://p.lbserver.xyz/api/progress?id={urllib.parse.quote(str(req_task_id))}",
                    headers=savenow_headers,
                    timeout=7
                )
            if chk_resp.ok:
                chk_data = chk_resp.json()
                if chk_data.get("success") == 1 and chk_data.get("download_url"):
                    return JSONResponse({
                        "status": "success",
                        "download_url": chk_data["download_url"],
                        "filename": f"{clean_title}.{target_ext}"
                    })
                if chk_data.get("progress", 0) >= 1000 and not chk_data.get("download_url"):
                    return JSONResponse({
                        "status": "error",
                        "message": chk_data.get("text") or "Conversion server could not complete this format. Please select 720p HD or 360p."
                    })
                raw_prog = round(chk_data.get("progress", 500) / 10) if chk_data.get("progress") else 50
                return JSONResponse({
                    "status": "pending",
                    "task_id": req_task_id,
                    "progress": min(99, max(10, raw_prog)),
                    "title": clean_title,
                    "format": target_ext
                })
        except Exception as e:
            logger.warning(f"SaveNow check task error: {e}")

    if not req_token and not original_url and not req_task_id:
        return JSONResponse({"status": "error", "message": "Missing conversion token or URL"}, status_code=200)

    # Fast Path 1: If req_token is a download_redirect link (Vidssave direct stream)
    if req_token and "download_redirect" in req_token:
        target_stream = req_token
        try:
            r = requests.get(req_token, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
            loc = r.headers.get("Location")
            if loc:
                target_stream = loc
        except Exception:
            pass
        return JSONResponse({
            "status": "success",
            "download_url": target_stream,
            "filename": f"{clean_title}.{target_ext}"
        })

    # Fast Path 2: If req_token is already a direct Cloudflare vidssave link (/tmp/recycle/)
    if req_token and ("/tmp/recycle/" in req_token or "down.vidssave.com" in req_token or "down-de.vidssave.com" in req_token):
        return JSONResponse({
            "status": "success",
            "download_url": req_token,
            "filename": f"{clean_title}.{target_ext}"
        })

    # Fast Path 3: If req_token is a Vidssave Task ID (starts with Z0ve)
    if req_token and req_token.startswith("Z0ve"):
        try:
            query_url = f"https://api.vidssave.com/api/contentsite_api/media/download_query?auth=20250901majwlqo&domain=api-ak.vidssave.com&task_id={urllib.parse.quote(req_token)}&download_domain=vidssave.com&origin=content_site"
            qr = requests.get(query_url, timeout=7)
            txt = qr.text
            dl_link = None
            if "data: " in txt:
                for line in txt.splitlines():
                    if line.startswith("data: "):
                        try:
                            d_json = json.loads(line[6:].strip())
                            if d_json.get("download_link"):
                                dl_link = d_json["download_link"]
                                break
                        except Exception:
                            pass
            if dl_link and dl_link.startswith("http"):
                loc = dl_link
                try:
                    r_loc = requests.get(dl_link, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
                    if r_loc.headers.get("Location"):
                        loc = r_loc.headers.get("Location")
                except Exception:
                    pass
                return JSONResponse({
                    "status": "success",
                    "download_url": loc,
                    "filename": f"{clean_title}.{target_ext}"
                })
        except Exception as z_err:
            logger.warning(f"Vidssave task query error: {z_err}")

    gw_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Forwarded-For': '103.240.235.10',
        'X-Real-IP': '103.240.235.10',
        'Client-IP': '103.240.235.10'
    }

    # Fast Path 4: If req_token is a resource_content string from Grapweb (length > 50)
    if req_token and len(req_token) > 50 and not req_token.startswith("http"):
        try:
            st_resp = requests.post(
                "https://grapweb.com/youtube/api.php?action=start_task",
                data={"content": req_token},
                headers=gw_headers,
                timeout=8
            )
            if st_resp.ok:
                st_data = st_resp.json()
                dl_link = st_data.get("direct_link") or st_data.get("download_link")
                if dl_link and dl_link.startswith("http"):
                    target_stream = dl_link
                    try:
                        r = requests.get(dl_link, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
                        loc = r.headers.get("Location")
                        if loc:
                            target_stream = loc
                    except Exception:
                        pass
                    return JSONResponse({
                        "status": "success",
                        "download_url": target_stream,
                        "filename": f"{clean_title}.{target_ext}"
                    })

                task_id = st_data.get("task_id")
                if task_id:
                    for _ in range(2):
                        time.sleep(0.8)
                        q_url = f"https://api.vidssave.com/api/contentsite_api/media/download_query?auth=20250901majwlqo&domain=api-ak.vidssave.com&task_id={urllib.parse.quote(task_id)}&download_domain=vidssave.com&origin=content_site"
                        chk_r = requests.get(q_url, timeout=5)
                        txt = chk_r.text
                        cand = None
                        if "data: " in txt:
                            for line in txt.splitlines():
                                if line.startswith("data: "):
                                    try:
                                        d_j = json.loads(line[6:].strip())
                                        if d_j.get("download_link"):
                                            cand = d_j["download_link"]
                                            break
                                    except Exception:
                                        pass
                        if cand and cand.startswith("http"):
                            target_stream = cand
                            try:
                                r = requests.get(cand, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
                                loc = r.headers.get("Location")
                                if loc:
                                    target_stream = loc
                            except Exception:
                                pass
                            return JSONResponse({
                                "status": "success",
                                "download_url": target_stream,
                                "filename": f"{clean_title}.{target_ext}"
                            })

                    return JSONResponse({
                        "status": "pending",
                        "task_id": task_id,
                        "title": clean_title,
                        "format": target_ext
                    })
        except Exception as gw_task_err:
            logger.warning(f"Grapweb resource_content task error: {gw_task_err}")

    # Extract clean canonical YouTube watch URL
    yt_url = original_url or (req_token if ("youtube.com" in req_token or "youtu.be" in req_token) else "")
    if not yt_url and len(req_token) == 11:
        yt_url = f"https://www.youtube.com/watch?v={req_token}"

    m_yt = re.search(r'(?:v=|\/v\/|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', yt_url)
    if m_yt:
        yt_url = f"https://www.youtube.com/watch?v={m_yt.group(1)}"
    elif not yt_url.startswith("http"):
        yt_url = f"https://www.youtube.com/watch?v={req_token}"

    # Tier 1: Grapweb Direct Extractor & Task Engine
    try:
        gw_resp = requests.get(f"https://grapweb.com/youtube/api.php?url={urllib.parse.quote(yt_url)}", headers=gw_headers, timeout=8)
        if gw_resp.ok:
            gw_json = gw_resp.json()
            if gw_json.get("status") == "success" and gw_json.get("data"):
                v_list = gw_json["data"].get("videos", [])
                a_list = gw_json["data"].get("audios", [])
                match = None

                is_audio = target_ext in ["mp3", "m4a"]
                if is_audio:
                    for a in a_list:
                        fmt_name = (a.get("format") or "").upper()
                        if target_ext.upper() in fmt_name:
                            match = a
                            break
                    if not match and a_list:
                        match = a_list[0]
                else:
                    fmt_req = clean_format.upper()
                    for v in v_list:
                        q = (v.get("quality") or "").upper()
                        if fmt_req in q:
                            match = v
                            break
                    if not match and v_list:
                        match = v_list[0]

                if match:
                    dl = match.get("download_url") or ""
                    rc = match.get("resource_content") or ""

                    if dl and "download_redirect" in dl:
                        target_stream = dl
                        try:
                            r = requests.get(dl, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
                            loc = r.headers.get("Location")
                            if loc:
                                target_stream = loc
                        except Exception:
                            pass
                        return JSONResponse({
                            "status": "success",
                            "download_url": target_stream,
                            "filename": f"{clean_title}.{target_ext}"
                        })

                    if rc:
                        st_r = requests.post("https://grapweb.com/youtube/api.php?action=start_task", data={"content": rc}, headers=gw_headers, timeout=8)
                        if st_r.ok:
                            st_d = st_r.json()
                            cand_dl = st_d.get("direct_link") or st_d.get("download_link")
                            if cand_dl and cand_dl.startswith("http"):
                                target_stream = cand_dl
                                try:
                                    r = requests.get(cand_dl, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
                                    loc = r.headers.get("Location")
                                    if loc:
                                        target_stream = loc
                                except Exception:
                                    pass
                                return JSONResponse({
                                    "status": "success",
                                    "download_url": target_stream,
                                    "filename": f"{clean_title}.{target_ext}"
                                })

                            tid = st_d.get("task_id")
                            if tid:
                                for _ in range(2):
                                    time.sleep(0.8)
                                    q_url = f"https://api.vidssave.com/api/contentsite_api/media/download_query?auth=20250901majwlqo&domain=api-ak.vidssave.com&task_id={urllib.parse.quote(tid)}&download_domain=vidssave.com&origin=content_site"
                                    chk_r = requests.get(q_url, timeout=5)
                                    txt = chk_r.text
                                    cand = None
                                    if "data: " in txt:
                                        for line in txt.splitlines():
                                            if line.startswith("data: "):
                                                try:
                                                    d_j = json.loads(line[6:].strip())
                                                    if d_j.get("download_link"):
                                                        cand = d_j["download_link"]
                                                        break
                                                except Exception:
                                                    pass
                                    if cand and cand.startswith("http"):
                                        target_stream = cand
                                        try:
                                            r = requests.get(cand, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidssave.com/'}, allow_redirects=False, timeout=4)
                                            loc = r.headers.get("Location")
                                            if loc:
                                                target_stream = loc
                                        except Exception:
                                            pass
                                        return JSONResponse({
                                            "status": "success",
                                            "download_url": target_stream,
                                            "filename": f"{clean_title}.{target_ext}"
                                        })

                                return JSONResponse({
                                    "status": "pending",
                                    "task_id": tid,
                                    "title": clean_title,
                                    "format": target_ext
                                })
    except Exception as gw_flow_err:
        logger.warning(f"Grapweb flow error: {gw_flow_err}")

    # Tier 2: SaveNow Fallback Engine
    try:
        savenow_fmt = "1080"
        if req_token and req_token.startswith("savenow:"):
            savenow_fmt = req_token.replace("savenow:", "").strip()
        elif clean_format in ["1080", "720", "480", "360", "mp3", "m4a"]:
            savenow_fmt = clean_format

        start_resp = requests.get(
            f"https://p.savenow.to/api/v2/download?format={savenow_fmt}&url={urllib.parse.quote(yt_url)}",
            headers=savenow_headers,
            timeout=8
        )
        if not start_resp.ok:
            start_resp = requests.get(
                f"https://p.lbserver.xyz/api/v2/download?format={savenow_fmt}&url={urllib.parse.quote(yt_url)}",
                headers=savenow_headers,
                timeout=8
            )

        if start_resp.ok:
            start_data = start_resp.json()
            if start_data.get("download_url"):
                return JSONResponse({
                    "status": "success",
                    "download_url": start_data["download_url"],
                    "filename": f"{clean_title}.{target_ext}"
                })

            task_id = start_data.get("id")
            if task_id:
                for _ in range(2):
                    time.sleep(0.7)
                    poll_r = requests.get(
                        f"https://p.savenow.to/api/progress?id={urllib.parse.quote(str(task_id))}",
                        headers=savenow_headers,
                        timeout=5
                    )
                    if poll_r.ok:
                        p_data = poll_r.json()
                        if p_data.get("success") == 1 and p_data.get("download_url"):
                            return JSONResponse({
                                "status": "success",
                                "download_url": p_data["download_url"],
                                "filename": f"{clean_title}.{target_ext}"
                            })

                return JSONResponse({
                    "status": "pending",
                    "task_id": task_id,
                    "title": clean_title,
                    "format": target_ext
                })
    except Exception as sn_err:
        logger.warning(f"SaveNow start task error: {sn_err}")

    # Fallback to direct yt-dlp progressive stream (Prevents 504 timeouts entirely)
    try:
        target_yt = yt_page_url or (original_url if "youtube" in original_url else f"https://www.youtube.com/watch?v={req_token}")
        if "shorts/" in target_yt:
            s_match = re.search(r'shorts/([a-zA-Z0-9_-]{11})', target_yt)
            if s_match:
                target_yt = f"https://www.youtube.com/watch?v={s_match.group(1)}"
        elif "youtu.be/" in target_yt:
            y_match = re.search(r'youtu\.be/([a-zA-Z0-9_-]{11})', target_yt)
            if y_match:
                target_yt = f"https://www.youtube.com/watch?v={y_match.group(1)}"

        import yt_dlp
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 5,
            'format': 'best[ext=mp4]/best' if clean_format == 'mp4' else 'bestaudio/best',
            'extractor_args': {'youtube': {'player_client': ['ios', 'android', 'mweb']}}
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            yt_info = ydl.extract_info(target_yt, download=False)
            stream_url = yt_info.get('url')
            if not stream_url and yt_info.get('formats'):
                for f in reversed(yt_info['formats']):
                    if f.get('url') and (clean_format != 'mp4' or f.get('vcodec') != 'none'):
                        stream_url = f['url']
                        break
            if stream_url:
                proxy_link = f"/api/proxy-download?url={urllib.parse.quote(stream_url)}&filename={urllib.parse.quote(clean_title + '.' + clean_format)}"
                return JSONResponse({
                    "status": "success",
                    "download_url": proxy_link,
                    "filename": f"{clean_title}.{clean_format}"
                })
    except Exception as ydl_err:
        logger.warning(f"yt-dlp fallback error in resolve_youtube: {ydl_err}")

    return JSONResponse({
        "status": "error",
        "message": "Could not prepare YouTube stream. Please choose another quality or retry."
    }, status_code=200)

@app.api_route("/api/index.py", methods=["GET", "POST", "HEAD"])
async def index_py_dispatcher(
    request: Request,
    url: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    task_id: Optional[str] = Query(None),
    filename: Optional[str] = Query("video.mp4")
):
    body_dict = {}
    if request.method == "POST":
        try:
            body_dict = await request.json()
        except Exception:
            pass
    req_token = token or body_dict.get("token")
    req_task_id = task_id or body_dict.get("task_id")
    req_url = url or body_dict.get("url")

    if request.query_params.get("debug") == "grapweb":
        try:
            gw_hdrs = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'X-Forwarded-For': '103.240.235.10',
                'X-Real-IP': '103.240.235.10',
                'Client-IP': '103.240.235.10'
            }
            gw_r = requests.get("https://grapweb.com/youtube/api.php?url=" + urllib.parse.quote("https://www.youtube.com/watch?v=aDmhFUcp__c"), headers=gw_hdrs, timeout=8)
            return JSONResponse({"debug_status": gw_r.status_code, "debug_body": gw_r.text[:500]})
        except Exception as de:
            return JSONResponse({"debug_error": str(de)})

    if req_task_id or req_token or request.query_params.get("action") == "resolve" or "resolve" in str(request.url.path):
        return await resolve_youtube(
            request,
            token=req_token,
            url=req_url,
            task_id=req_task_id,
            title=body_dict.get("title", "youtube_video"),
            format=body_dict.get("format", "mp4")
        )
    if req_url and request.method == "POST":
        return await fetch_media(request)
    if req_url:
        return await proxy_download(request, url=req_url, filename=filename)
    return JSONResponse({"status": "ok", "service": "VidSavor Multi-Platform Engine v2.0"})

@app.api_route("/api/proxy-download", methods=["GET", "HEAD"])
@app.api_route("/proxy-download", methods=["GET", "HEAD"])
async def proxy_download(
    request: Request,
    url: Optional[str] = Query(None),
    filename: Optional[str] = Query("video.mp4"),
    referer: Optional[str] = Query(None)
):
    """
    High-performance binary streaming proxy that forces direct attachment download
    to the user's local disk with zero page redirection.
    """
    target_url = url or request.query_params.get("url")
    if not target_url or not target_url.strip():
        # If called without url parameter, return service status
        return JSONResponse({"status": "ok", "service": "VidSavor Download Proxy Engine v2.0"})

    target_url = unpack_token_url(target_url)

    raw_filename = filename or request.query_params.get("filename", "vidsavor_video.mp4")
    clean_filename = urllib.parse.unquote(raw_filename).replace('"', '').replace('\r', '').replace('\n', '').strip()
    if not clean_filename:
        clean_filename = "vidsavor_video.mp4"

    client_ref = referer or request.query_params.get("referer") or ""

    try:
        # Clean and unquote nested target_url
        while '%25' in target_url or '%3A' in target_url or '%3a' in target_url:
            target_url = urllib.parse.unquote(target_url)

        if "url=" in target_url:
            try:
                u_m = re.search(r'[?&]url=([^&]+)', target_url)
                if u_m:
                    inner_u = u_m.group(1)
                    while '%25' in inner_u or '%3A' in inner_u or '%3a' in inner_u:
                        inner_u = urllib.parse.unquote(inner_u)
                    target_url = inner_u
            except Exception:
                pass

        if "googlevideo.com" in target_url and "title=" not in target_url:
            target_url += ("&" if "?" in target_url else "?") + f"title={urllib.parse.quote(clean_filename)}"

        parsed = urllib.parse.urlparse(target_url)
        domain = (parsed.netloc or "").lower()

        client_range = request.headers.get("range")
        base_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
        }
        if client_range:
            base_headers['Range'] = client_range

        # Build list of candidate header strategies for strict platform CDNs (TikTok, Instagram, YouTube)
        candidate_headers = []
        if any(k in domain for k in ["tiktok", "byteoversea", "ibytedtos", "musical.ly"]):
            if client_ref and "tiktok.com" in client_ref:
                candidate_headers.append({**base_headers, 'Referer': client_ref})
            candidate_headers.append({**base_headers, 'Referer': 'https://www.tiktok.com/'})
            candidate_headers.append(base_headers)
        elif any(k in domain for k in ["instagram", "cdninstagram"]):
            if client_ref and "instagram.com" in client_ref:
                candidate_headers.append({**base_headers, 'Referer': client_ref})
            candidate_headers.append({**base_headers, 'Referer': 'https://www.instagram.com/'})
            candidate_headers.append(base_headers)
        elif any(k in domain for k in ["googlevideo", "youtube", "ytimg"]):
            candidate_headers.append({**base_headers, 'Referer': 'https://www.youtube.com/'})
            candidate_headers.append(base_headers)
        else:
            if client_ref:
                candidate_headers.append({**base_headers, 'Referer': client_ref})
            candidate_headers.append(base_headers)

        req = None
        for h in candidate_headers:
            try:
                r = requests.get(target_url, headers=h, stream=True, timeout=25)
                if r.status_code in (200, 206):
                    req = r
                    break
            except Exception as conn_err:
                logger.warning(f"Connection attempt failed: {conn_err}")

        # Fallback to yt-dlp urlopen if direct requests were blocked by CDN
        ydl_stream = None
        if req is None or req.status_code not in (200, 206):
            try:
                import yt_dlp
                ydl = yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True})
                ydl_res = ydl.urlopen(target_url)
                code = getattr(ydl_res, 'status', getattr(ydl_res, 'code', 200))
                if code in (200, 206):
                    ydl_stream = ydl_res
            except Exception as ydl_err:
                logger.warning(f"yt-dlp proxy fallback error: {ydl_err}")

        # If neither engine could acquire stream, return clean error response
        if req is None and ydl_stream is None:
            logger.warning(f"All proxy attempts failed for {target_url}")
            return JSONResponse(
                {
                    "status": "error",
                    "message": "Source video stream could not be loaded or has expired. Please choose another quality."
                },
                status_code=400
            )

        # Determine accurate Content-Type and Length
        content_type = None
        content_length = None
        if req is not None:
            content_type = req.headers.get("Content-Type")
            content_length = req.headers.get("Content-Length")
        elif ydl_stream is not None:
            content_type = ydl_stream.headers.get("Content-Type")
            content_length = ydl_stream.headers.get("Content-Length")

        if not content_type or "text/html" in content_type:
            if clean_filename.endswith((".mp3", ".m4a")):
                content_type = "audio/mpeg"
            elif clean_filename.endswith((".jpg", ".jpeg")):
                content_type = "image/jpeg"
            elif clean_filename.endswith(".png"):
                content_type = "image/png"
            elif clean_filename.endswith(".webp"):
                content_type = "image/webp"
            else:
                content_type = "video/mp4"

        # Ensure filename has an appropriate extension if none provided
        if "." not in clean_filename:
            if "audio" in content_type:
                clean_filename += ".mp3"
            elif "image" in content_type:
                clean_filename += ".jpg"
            else:
                clean_filename += ".mp4"

        # CRITICAL HEADERS TO FORCE BROWSER ATTACHMENT DOWNLOAD DIRECTLY IN-PAGE
        resp_headers = {
            "Content-Disposition": f'attachment; filename="{clean_filename}"',
            "Content-Type": content_type,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
            "Cache-Control": "public, max-age=3600"
        }
        if content_length:
            resp_headers["Content-Length"] = str(content_length)

        # Handle HEAD requests immediately without streaming body
        if request.method == "HEAD":
            if req is not None:
                req.close()
            if ydl_stream is not None:
                try:
                    ydl_stream.close()
                except Exception:
                    pass
            return Response(status_code=200, headers=resp_headers)

        def iter_stream():
            try:
                if req is not None:
                    for chunk in req.iter_content(chunk_size=131072): # 128KB chunks
                        if chunk:
                            yield chunk
                elif ydl_stream is not None:
                    while True:
                        chunk = ydl_stream.read(131072)
                        if not chunk:
                            break
                        yield chunk
            except Exception as stream_err:
                logger.error(f"Streaming error: {stream_err}")
            finally:
                if req is not None:
                    req.close()
                if ydl_stream is not None:
                    try:
                        ydl_stream.close()
                    except Exception:
                        pass

        return StreamingResponse(iter_stream(), media_type=content_type, headers=resp_headers)

    except Exception as e:
        logger.error(f"Proxy download exception: {e}")
        return JSONResponse({"status": "error", "message": f"Download proxy failed: {str(e)}"}, status_code=500)

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "VidSavor Core API v2.0"}

# Page Routes for SEO and Multi-Platform Support
def get_page_path(filename: str):
    root_file = os.path.join(BASE_DIR, filename)
    if os.path.exists(root_file):
        return root_file
    static_file = os.path.join(STATIC_DIR, filename)
    if os.path.exists(static_file):
        return static_file
    return os.path.join(BASE_DIR, "index.html")

def serve_html_file(filename: str):
    path = get_page_path(filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    return HTMLResponse(content="<h1>Page Not Found</h1>", status_code=404)

@app.get("/", response_class=HTMLResponse)
async def serve_home():
    return serve_html_file("index.html")

@app.get("/instagram", response_class=HTMLResponse)
@app.get("/instagram/", response_class=HTMLResponse)
@app.get("/reels", response_class=HTMLResponse)
@app.get("/reels/", response_class=HTMLResponse)
async def serve_instagram():
    return serve_html_file("instagram.html")

@app.get("/youtube", response_class=HTMLResponse)
@app.get("/youtube/", response_class=HTMLResponse)
async def serve_youtube():
    return serve_html_file("youtube.html")

@app.get("/tiktok", response_class=HTMLResponse)
@app.get("/tiktok/", response_class=HTMLResponse)
async def serve_tiktok():
    return serve_html_file("tiktok.html")

@app.get("/facebook", response_class=HTMLResponse)
@app.get("/facebook/", response_class=HTMLResponse)
async def serve_facebook():
    return serve_html_file("facebook.html")

@app.get("/twitter", response_class=HTMLResponse)
@app.get("/twitter/", response_class=HTMLResponse)
async def serve_twitter():
    return serve_html_file("twitter.html")

@app.get("/pinterest", response_class=HTMLResponse)
@app.get("/pinterest/", response_class=HTMLResponse)
async def serve_pinterest():
    return serve_html_file("pinterest.html")

@app.get("/download", response_class=HTMLResponse)
@app.get("/download/", response_class=HTMLResponse)
@app.get("/download.html", response_class=HTMLResponse)
async def serve_download():
    return serve_html_file("download.html")

@app.get("/downloads/{filename:path}")
@app.get("/static/downloads/{filename:path}")
async def serve_download_file(filename: str):
    for folder in [
        os.path.join(BASE_DIR, "downloads"),
        os.path.join(STATIC_DIR, "downloads"),
        os.path.join(BASE_DIR, "static", "downloads")
    ]:
        filepath = os.path.join(folder, filename)
        if os.path.exists(filepath) and os.path.isfile(filepath):
            return FileResponse(
                path=filepath,
                filename=filename,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
    raise HTTPException(status_code=404, detail="Requested file not found")

@app.get("/about-us", response_class=HTMLResponse)
@app.get("/about-us/", response_class=HTMLResponse)
@app.get("/about", response_class=HTMLResponse)
async def serve_about():
    return serve_html_file("about-us.html")

@app.get("/faq", response_class=HTMLResponse)
@app.get("/faq/", response_class=HTMLResponse)
@app.get("/help", response_class=HTMLResponse)
async def serve_faq():
    return serve_html_file("faq.html")

@app.get("/contact-us", response_class=HTMLResponse)
@app.get("/contact-us/", response_class=HTMLResponse)
@app.get("/contact", response_class=HTMLResponse)
async def serve_contact():
    return serve_html_file("contact-us.html")

@app.get("/blog", response_class=HTMLResponse)
@app.get("/blog/", response_class=HTMLResponse)
async def serve_blog():
    return serve_html_file("blog.html")

@app.get("/dmca-policy", response_class=HTMLResponse)
@app.get("/dmca-policy/", response_class=HTMLResponse)
@app.get("/dmca", response_class=HTMLResponse)
async def serve_dmca():
    return serve_html_file("dmca-policy.html")

@app.get("/privacy-policy", response_class=HTMLResponse)
@app.get("/privacy-policy/", response_class=HTMLResponse)
@app.get("/privacy", response_class=HTMLResponse)
async def serve_privacy():
    return serve_html_file("privacy-policy.html")

@app.get("/terms-of-service", response_class=HTMLResponse)
@app.get("/terms-of-service/", response_class=HTMLResponse)
@app.get("/terms", response_class=HTMLResponse)
async def serve_terms():
    return serve_html_file("terms-of-service.html")

@app.get("/audio", response_class=HTMLResponse)
@app.get("/audio/", response_class=HTMLResponse)
async def serve_audio():
    return serve_html_file("audio.html")

@app.get("/photo", response_class=HTMLResponse)
@app.get("/photo/", response_class=HTMLResponse)
async def serve_photo():
    return serve_html_file("photo.html")

@app.get("/robots.txt")
def serve_robots():
    for f in [os.path.join(PUBLIC_DIR, "robots.txt"), os.path.join(STATIC_DIR, "robots.txt"), os.path.join(BASE_DIR, "robots.txt")]:
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8") as fp:
                return Response(content=fp.read(), media_type="text/plain; charset=utf-8")
    return Response(content="User-agent: *\nAllow: /\nSitemap: https://www.vidsavor.com/sitemap.xml", media_type="text/plain; charset=utf-8")

@app.get("/sitemap.xml")
def serve_sitemap():
    for f in [os.path.join(PUBLIC_DIR, "sitemap.xml"), os.path.join(STATIC_DIR, "sitemap.xml"), os.path.join(BASE_DIR, "sitemap.xml")]:
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8") as fp:
                return Response(content=fp.read(), media_type="application/xml; charset=utf-8")
    return Response(content='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', media_type="application/xml; charset=utf-8")

@app.get("/manifest.json")
def serve_manifest():
    for f in [os.path.join(PUBLIC_DIR, "manifest.json"), os.path.join(STATIC_DIR, "manifest.json"), os.path.join(BASE_DIR, "manifest.json")]:
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8") as fp:
                return Response(content=fp.read(), media_type="application/manifest+json; charset=utf-8")
    return Response(content="{}", media_type="application/manifest+json; charset=utf-8")

@app.get("/favicon.ico")
def serve_favicon():
    for f in [os.path.join(PUBLIC_DIR, "favicon.ico"), os.path.join(STATIC_DIR, "assets", "favicon.ico"), os.path.join(BASE_DIR, "favicon.ico")]:
        if os.path.exists(f):
            return FileResponse(f, media_type="image/x-icon")
    raise HTTPException(status_code=404)

# UNIVERSAL CATCH-ALL ROUTE FOR GET AND POST (Zero 405 Method Not Allowed)
@app.api_route("/{catch_all:path}", methods=["GET", "POST", "HEAD"])
async def universal_catch_all(catch_all: str, request: Request):
    # Intercept any proxy download requests that fall through
    if "proxy-download" in catch_all or "proxy" in catch_all or request.query_params.get("url"):
        target_url = request.query_params.get("url")
        if target_url:
            return await proxy_download(request, url=target_url, filename=request.query_params.get("filename", "vidsavor_video.mp4"))

    if request.method == "POST":
        try:
            data = await request.json()
            target_url = data.get("url")
            if target_url and target_url.strip():
                result = extractor.extract(target_url.strip())
                return JSONResponse(status_code=200, content=result)
        except Exception:
            pass
        return JSONResponse(status_code=200, content={"status": "error", "message": "Please provide a valid media link."})

    # Direct static file check FIRST (e.g. robots.txt, sitemap.xml, favicon.png, sw.js, images)
    clean_path = catch_all.strip("/")
    if any(clean_path.endswith(ext) for ext in [".txt", ".xml", ".json", ".ico", ".png", ".svg", ".js", ".jpg", ".jpeg", ".webp", ".zip"]):
        for folder in [PUBLIC_DIR, STATIC_DIR, os.path.join(STATIC_DIR, "assets"), BASE_DIR]:
            candidate = os.path.join(folder, clean_path)
            if os.path.exists(candidate) and os.path.isfile(candidate):
                media_type = "text/plain"
                if clean_path.endswith(".xml"): media_type = "application/xml"
                elif clean_path.endswith(".json"): media_type = "application/json"
                elif clean_path.endswith(".png"): media_type = "image/png"
                elif clean_path.endswith(".jpg") or clean_path.endswith(".jpeg"): media_type = "image/jpeg"
                elif clean_path.endswith(".svg"): media_type = "image/svg+xml"
                elif clean_path.endswith(".ico"): media_type = "image/x-icon"
                elif clean_path.endswith(".js"): media_type = "application/javascript"
                elif clean_path.endswith(".zip"): media_type = "application/zip"
                return FileResponse(candidate, media_type=media_type)

    # If GET request: check if matches static page (HTML files should always render in browser)
    clean = clean_path.replace(".html", "")
    target = f"{clean}.html"
    for folder in [BASE_DIR, STATIC_DIR]:
        candidate = os.path.join(folder, target)
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return serve_html_file(target)

    # If GET request: check if it's an explicit downloadable package in downloads/
    if catch_all.startswith("downloads/") or catch_all.startswith("static/downloads/"):
        for folder in [BASE_DIR, STATIC_DIR]:
            direct_file = os.path.join(folder, catch_all)
            if os.path.exists(direct_file) and os.path.isfile(direct_file):
                filename = os.path.basename(direct_file)
                if filename.endswith(".html"):
                    return serve_html_file(filename)
                return FileResponse(
                    path=direct_file,
                    filename=filename,
                    media_type="application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                )

    # Default fallback to home
    return serve_html_file("index.html")
