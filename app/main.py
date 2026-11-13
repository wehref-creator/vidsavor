import os
import urllib.parse
import logging
import requests
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
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

@app.api_route("/api/proxy-download", methods=["GET", "HEAD"])
@app.api_route("/proxy-download", methods=["GET", "HEAD"])
@app.api_route("/api/index.py", methods=["GET", "HEAD"])
async def proxy_download(request: Request, url: Optional[str] = Query(None), filename: Optional[str] = Query("video.mp4")):
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

    try:
        parsed = urllib.parse.urlparse(target_url)
        domain = (parsed.netloc or "").lower()

        # Determine optimal platform Referer to avoid anti-hotlinking 403 Forbidden
        if any(k in domain for k in ["tiktok", "byteoversea", "ibytedtos", "musical.ly"]):
            referer = "https://www.tiktok.com/"
        elif any(k in domain for k in ["instagram", "cdninstagram"]):
            referer = "https://www.instagram.com/"
        elif any(k in domain for k in ["googlevideo", "youtube", "ytimg"]):
            referer = "https://www.youtube.com/"
        elif any(k in domain for k in ["facebook", "fbcdn"]):
            referer = "https://www.facebook.com/"
        elif any(k in domain for k in ["twimg", "twitter", "x.com"]):
            referer = "https://x.com/"
        elif any(k in domain for k in ["pinimg", "pinterest"]):
            referer = "https://www.pinterest.com/"
        else:
            referer = f"{parsed.scheme}://{parsed.netloc}/" if parsed.netloc else ""

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Referer': referer
        }
        
        req = requests.get(target_url, headers=headers, stream=True, timeout=35)
        
        # If 403 Forbidden with platform Referer, retry with Range header and empty Referer (bypasses TikTok/Instagram CDN blocks)
        if req.status_code == 403:
            headers_fallback = dict(headers)
            headers_fallback['Referer'] = ''
            headers_fallback['Range'] = 'bytes=0-'
            req_fb = requests.get(target_url, headers=headers_fallback, stream=True, timeout=35)
            if req_fb.status_code in (200, 206):
                req = req_fb

        # Verify target stream status
        if req.status_code not in (200, 206):
            logger.warning(f"Target CDN returned HTTP {req.status_code} for {target_url}")
            return JSONResponse(
                {
                    "status": "error",
                    "code": req.status_code,
                    "message": f"Source stream returned HTTP {req.status_code}. Stream might be geo-restricted or expired.",
                    "direct_url": target_url
                },
                status_code=req.status_code
            )

        # Determine accurate Content-Type
        content_type = req.headers.get("Content-Type")
        if not content_type or "text/html" in content_type:
            if clean_filename.endswith(".mp3") or clean_filename.endswith(".m4a"):
                content_type = "audio/mpeg"
            elif clean_filename.endswith(".jpg") or clean_filename.endswith(".jpeg"):
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

        def iter_stream():
            try:
                for chunk in req.iter_content(chunk_size=131072): # 128KB chunks
                    if chunk:
                        yield chunk
            except Exception as stream_err:
                logger.error(f"Streaming error: {stream_err}")
            finally:
                req.close()

        content_length = req.headers.get("Content-Length")

        # CRITICAL HEADERS TO FORCE BROWSER ATTACHMENT DOWNLOAD RIGHT ON THE PAGE
        resp_headers = {
            "Content-Disposition": f'attachment; filename="{clean_filename}"',
            "Content-Type": content_type,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
            "Cache-Control": "public, max-age=3600"
        }
        if content_length:
            resp_headers["Content-Length"] = content_length

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

    # If GET request: check if matches static page
    clean = catch_all.strip("/").replace(".html", "")
    target = f"{clean}.html"
    for folder in [BASE_DIR, STATIC_DIR]:
        candidate = os.path.join(folder, target)
        if os.path.exists(candidate):
            return serve_html_file(target)
    # Default fallback to home
    return serve_html_file("index.html")
