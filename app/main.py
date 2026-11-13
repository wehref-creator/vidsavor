import os
import urllib.parse
import logging
import requests
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, RedirectResponse
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

@app.get("/api/proxy-download")
@app.get("/proxy-download")
async def proxy_download(url: str = Query(...), filename: str = Query("video.mp4")):
    """
    Stream download proxy to bypass CORS and anti-hotlinking,
    and force attachment download of the real video directly to user's disk.
    """
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="Missing media URL parameter.")

    clean_filename = urllib.parse.unquote(filename).replace('"', '').replace('\n', '').strip()
    if not clean_filename:
        clean_filename = "vidsavor_media.mp4"

    try:
        parsed = urllib.parse.urlparse(url)
        referer = f"{parsed.scheme}://{parsed.netloc}/" if parsed.netloc else ""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Referer': referer
        }
        
        req = requests.get(url, headers=headers, stream=True, timeout=25)
        if req.status_code not in (200, 206):
            # Fallback directly to source CDN if proxying is blocked by source
            return RedirectResponse(url=url, status_code=302)

        def iter_stream():
            try:
                for chunk in req.iter_content(chunk_size=131072): # 128KB chunks
                    if chunk:
                        yield chunk
            except Exception as stream_err:
                logger.error(f"Streaming error: {stream_err}")

        content_type = req.headers.get("Content-Type")
        if not content_type or "text/html" in content_type:
            if clean_filename.endswith(".mp3"):
                content_type = "audio/mpeg"
            elif clean_filename.endswith(".jpg") or clean_filename.endswith(".jpeg"):
                content_type = "image/jpeg"
            elif clean_filename.endswith(".png"):
                content_type = "image/png"
            else:
                content_type = "video/mp4"

        content_length = req.headers.get("Content-Length")

        resp_headers = {
            "Content-Disposition": f'attachment; filename="{clean_filename}"',
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600"
        }
        if content_length:
            resp_headers["Content-Length"] = content_length

        return StreamingResponse(iter_stream(), media_type=content_type, headers=resp_headers)

    except Exception as e:
        logger.error(f"Proxy download exception: {e}")
        # Safe fallback: redirect directly to source URL
        return RedirectResponse(url=url, status_code=302)

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
@app.api_route("/{catch_all:path}", methods=["GET", "POST"])
async def universal_catch_all(catch_all: str, request: Request):
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
