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

from app.extractor import extractor

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

# Mount static files if static folder exists
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

class FetchRequest(BaseModel):
    url: str

@app.post("/fetch")
@app.post("/api/fetch")
@app.post("/api/index.py")
@app.post("/api")
async def fetch_media(req: FetchRequest):
    """Primary extraction endpoint matching freevideosave.com contract."""
    if not req.url or not req.url.strip():
        return JSONResponse(
            status_code=200,
            content={"status": "error", "message": "Please paste a valid video or post link."}
        )
    
    result = extractor.extract(req.url.strip())
    return JSONResponse(status_code=200, content=result)

@app.api_route("/api/resolve-youtube", methods=["GET", "POST"])
@app.api_route("/resolve-youtube", methods=["GET", "POST"])
async def resolve_youtube(
    request: Request,
    token: Optional[str] = Query(None),
    title: Optional[str] = Query("youtube_video"),
    format: Optional[str] = Query("mp4"),
    url: Optional[str] = Query(None)
):
    """
    Resolves YouTube video streams into high-speed unthrottled direct downloads
    using the dedicated Hostinger grapweb engine.
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

    req_token = token or body_data.get("token") or body_data.get("url") or url or request.query_params.get("token") or request.query_params.get("url")
    req_title = title or body_data.get("title") or request.query_params.get("title", "youtube_video")
    req_format = format or body_data.get("format") or request.query_params.get("format", "mp4")

    # Sanitize title
    clean_title = re.sub(r'[^a-zA-Z0-9_\-\s]', '', req_title).strip()
    clean_title = re.sub(r'\s+', '_', clean_title)[:60] or "youtube_video"
    clean_format = (req_format or "mp4").lower().strip()
    if clean_format not in ["mp4", "mp3", "m4a", "webm"]:
        clean_format = "mp4"

    if not req_token:
        return JSONResponse({"status": "error", "message": "Missing conversion token or URL"}, status_code=400)

    # If already a direct download redirect link
    if "download_redirect" in req_token:
        try:
            r = requests.get(req_token, headers={'User-Agent': 'Mozilla/5.0'}, allow_redirects=False, timeout=8)
            real_url = r.headers.get("Location") or req_token
            return JSONResponse({
                "status": "success",
                "download_url": real_url,
                "filename": f"{clean_title}.{clean_format}"
            })
        except Exception:
            pass

    try:
        # Start conversion task on grapweb engine
        st_resp = requests.post("https://grapweb.com/youtube/api.php", data={
            "action": "start_task",
            "content": req_token,
            "title": clean_title,
            "format": clean_format
        }, timeout=10)
        st_data = st_resp.json()

        # If direct link returned immediately
        dl_link = st_data.get("direct_link") or st_data.get("download_link")
        if dl_link and dl_link.startswith("http"):
            try:
                r = requests.get(dl_link, headers={'User-Agent': 'Mozilla/5.0'}, allow_redirects=False, timeout=8)
                real_url = r.headers.get("Location") or dl_link
                return JSONResponse({
                    "status": "success",
                    "download_url": real_url,
                    "filename": f"{clean_title}.{clean_format}"
                })
            except Exception:
                return JSONResponse({
                    "status": "success",
                    "download_url": dl_link,
                    "filename": f"{clean_title}.{clean_format}"
                })

        task_id = st_data.get("task_id")
        if not task_id:
            return JSONResponse({
                "status": "error",
                "message": st_data.get("message", "Could not initialize conversion task")
            }, status_code=400)

        # Poll task until complete (max 10 iterations * 1.2s = 12s)
        for _ in range(10):
            time.sleep(1.2)
            chk_resp = requests.get(
                f"https://grapweb.com/youtube/api.php?action=check_task&task_id={urllib.parse.quote(task_id)}&title={urllib.parse.quote(clean_title)}&format={clean_format}",
                timeout=10
            )
            chk_data = chk_resp.json()
            cand_link = chk_data.get("direct_link")
            if not cand_link and chk_data.get("download_link") and chk_data["download_link"].startswith("http"):
                cand_link = chk_data["download_link"]

            if cand_link:
                try:
                    r = requests.get(cand_link, headers={'User-Agent': 'Mozilla/5.0'}, allow_redirects=False, timeout=8)
                    real_url = r.headers.get("Location") or cand_link
                except Exception:
                    real_url = cand_link
                return JSONResponse({
                    "status": "success",
                    "download_url": real_url,
                    "filename": f"{clean_title}.{clean_format}"
                })

        return JSONResponse({
            "status": "error",
            "message": "Conversion task is taking longer than expected. Please retry."
        }, status_code=504)
    except Exception as err:
        logger.error(f"resolve_youtube error: {err}")
        return JSONResponse({"status": "error", "message": str(err)}, status_code=500)

@app.api_route("/api/proxy-download", methods=["GET", "HEAD"])
@app.api_route("/proxy-download", methods=["GET", "HEAD"])
@app.api_route("/api/index.py", methods=["GET", "HEAD"])
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

    raw_filename = filename or request.query_params.get("filename", "vidsavor_video.mp4")
    clean_filename = urllib.parse.unquote(raw_filename).replace('"', '').replace('\r', '').replace('\n', '').strip()
    if not clean_filename:
        clean_filename = "vidsavor_video.mp4"

    client_ref = referer or request.query_params.get("referer") or ""

    try:
        parsed = urllib.parse.urlparse(target_url)
        domain = (parsed.netloc or "").lower()

        base_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Range': 'bytes=0-',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
        }

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

    # If GET request: check if matches physical downloadable file
    for folder in [BASE_DIR, STATIC_DIR]:
        direct_file = os.path.join(folder, catch_all)
        if os.path.exists(direct_file) and os.path.isfile(direct_file):
            filename = os.path.basename(direct_file)
            return FileResponse(
                path=direct_file,
                filename=filename,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )

    # If GET request: check if matches static page
    clean = catch_all.strip("/").replace(".html", "")
    target = f"{clean}.html"
    for folder in [BASE_DIR, STATIC_DIR]:
        candidate = os.path.join(folder, target)
        if os.path.exists(candidate):
            return serve_html_file(target)
    # Default fallback to home
    return serve_html_file("index.html")
