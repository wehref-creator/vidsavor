import os
import urllib.parse
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

from app.extractor import extractor

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

# Fallback catch-all POST route for Vercel serverless rewrites
@app.post("/{catch_all:path}")
async def catch_all_post(catch_all: str, request: Request):
    try:
        data = await request.json()
        target_url = data.get("url")
        if target_url and target_url.strip():
            result = extractor.extract(target_url.strip())
            return JSONResponse(status_code=200, content=result)
    except Exception as e:
        pass
    return JSONResponse(status_code=200, content={"status": "error", "message": "Please provide a valid media link."})

@app.get("/api/proxy-download")
@app.get("/proxy-download")
async def proxy_download(url: str = Query(...), filename: str = Query("video.mp4")):
    """
    Stream download proxy to bypass CORS, anti-hotlinking, 
    and force attachment download directly to user's local disk.
    """
    try:
        clean_filename = urllib.parse.unquote(filename).replace('"', '')
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
        }
        
        req = requests.get(url, headers=headers, stream=True, timeout=30)
        if req.status_code != 200:
            raise HTTPException(status_code=req.status_code, detail="Failed to fetch media from source server.")

        def iter_stream():
            for chunk in req.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        content_type = req.headers.get("Content-Type", "application/octet-stream")
        content_length = req.headers.get("Content-Length")

        resp_headers = {
            "Content-Disposition": f'attachment; filename="{clean_filename}"',
            "Access-Control-Allow-Origin": "*",
        }
        if content_length:
            resp_headers["Content-Length"] = content_length

        return StreamingResponse(iter_stream(), media_type=content_type, headers=resp_headers)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download proxy error: {str(e)}")

@app.get("/health")
@app.get("/api/health")
@app.get("/api/index.py")
def health():
    return {"status": "ok", "service": "VidSavor Core API v2.0"}

# Page Routes for SEO and Multi-Platform Support
def get_page_path(filename: str):
    root_file = os.path.join(BASE_DIR, filename)
    if os.path.exists(root_file):
        return root_file
    return os.path.join(STATIC_DIR, filename)

@app.get("/", response_class=FileResponse)
async def serve_home():
    return FileResponse(get_page_path("index.html"))

@app.get("/instagram", response_class=FileResponse)
@app.get("/instagram/", response_class=FileResponse)
@app.get("/reels", response_class=FileResponse)
@app.get("/reels/", response_class=FileResponse)
async def serve_instagram():
    return FileResponse(get_page_path("instagram.html"))

@app.get("/youtube", response_class=FileResponse)
@app.get("/youtube/", response_class=FileResponse)
async def serve_youtube():
    return FileResponse(get_page_path("youtube.html"))

@app.get("/tiktok", response_class=FileResponse)
@app.get("/tiktok/", response_class=FileResponse)
async def serve_tiktok():
    return FileResponse(get_page_path("tiktok.html"))

@app.get("/facebook", response_class=FileResponse)
@app.get("/facebook/", response_class=FileResponse)
async def serve_facebook():
    return FileResponse(get_page_path("facebook.html"))

@app.get("/twitter", response_class=FileResponse)
@app.get("/twitter/", response_class=FileResponse)
async def serve_twitter():
    return FileResponse(get_page_path("twitter.html"))

@app.get("/pinterest", response_class=FileResponse)
@app.get("/pinterest/", response_class=FileResponse)
async def serve_pinterest():
    return FileResponse(get_page_path("pinterest.html"))

@app.get("/about-us", response_class=FileResponse)
@app.get("/about-us/", response_class=FileResponse)
@app.get("/about", response_class=FileResponse)
async def serve_about():
    return FileResponse(get_page_path("about-us.html"))

@app.get("/faq", response_class=FileResponse)
@app.get("/faq/", response_class=FileResponse)
@app.get("/help", response_class=FileResponse)
async def serve_faq():
    return FileResponse(get_page_path("faq.html"))

@app.get("/contact-us", response_class=FileResponse)
@app.get("/contact-us/", response_class=FileResponse)
@app.get("/contact", response_class=FileResponse)
async def serve_contact():
    return FileResponse(get_page_path("contact-us.html"))

@app.get("/blog", response_class=FileResponse)
@app.get("/blog/", response_class=FileResponse)
async def serve_blog():
    return FileResponse(get_page_path("blog.html"))

@app.get("/dmca-policy", response_class=FileResponse)
@app.get("/dmca-policy/", response_class=FileResponse)
@app.get("/dmca", response_class=FileResponse)
async def serve_dmca():
    return FileResponse(get_page_path("dmca-policy.html"))

@app.get("/privacy-policy", response_class=FileResponse)
@app.get("/privacy-policy/", response_class=FileResponse)
@app.get("/privacy", response_class=FileResponse)
async def serve_privacy():
    return FileResponse(get_page_path("privacy-policy.html"))

@app.get("/terms-of-service", response_class=FileResponse)
@app.get("/terms-of-service/", response_class=FileResponse)
@app.get("/terms", response_class=FileResponse)
async def serve_terms():
    return FileResponse(get_page_path("terms-of-service.html"))

@app.get("/audio", response_class=FileResponse)
@app.get("/audio/", response_class=FileResponse)
async def serve_audio():
    return FileResponse(get_page_path("audio.html"))

@app.get("/photo", response_class=FileResponse)
@app.get("/photo/", response_class=FileResponse)
async def serve_photo():
    return FileResponse(get_page_path("photo.html"))
