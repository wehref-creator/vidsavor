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

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

class FetchRequest(BaseModel):
    url: str

@app.post("/fetch")
async def fetch_media(req: FetchRequest):
    """Primary extraction endpoint matching freevideosave.com contract."""
    if not req.url or not req.url.strip():
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Please paste a valid video or post link."}
        )
    
    result = extractor.extract(req.url.strip())
    if result.get("status") == "error":
        return JSONResponse(status_code=200, content=result)
    
    return JSONResponse(status_code=200, content=result)

@app.get("/api/proxy-download")
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
def health():
    return {"status": "ok", "service": "VidSavor Core API v2.0"}

# Page Routes for SEO and Multi-Mode Support
@app.get("/", response_class=FileResponse)
async def serve_home():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/reels/", response_class=FileResponse)
@app.get("/reels", response_class=FileResponse)
async def serve_reels():
    return FileResponse(os.path.join(STATIC_DIR, "reels.html"))

@app.get("/audio/", response_class=FileResponse)
@app.get("/audio", response_class=FileResponse)
async def serve_audio():
    return FileResponse(os.path.join(STATIC_DIR, "audio.html"))

@app.get("/photo/", response_class=FileResponse)
@app.get("/photo", response_class=FileResponse)
async def serve_photo():
    return FileResponse(os.path.join(STATIC_DIR, "photo.html"))

@app.get("/privacy-policy.html", response_class=FileResponse)
@app.get("/privacy-policy", response_class=FileResponse)
async def serve_privacy():
    return FileResponse(os.path.join(STATIC_DIR, "privacy-policy.html"))

@app.get("/terms-of-service.html", response_class=FileResponse)
@app.get("/terms-of-service", response_class=FileResponse)
async def serve_terms():
    return FileResponse(os.path.join(STATIC_DIR, "terms-of-service.html"))

@app.get("/dmca-policy.html", response_class=FileResponse)
@app.get("/dmca-policy", response_class=FileResponse)
async def serve_dmca():
    return FileResponse(os.path.join(STATIC_DIR, "dmca-policy.html"))

@app.get("/contact-us.html", response_class=FileResponse)
@app.get("/contact-us", response_class=FileResponse)
async def serve_contact():
    return FileResponse(os.path.join(STATIC_DIR, "contact-us.html"))

@app.get("/about-us.html", response_class=FileResponse)
@app.get("/about-us", response_class=FileResponse)
async def serve_about():
    return FileResponse(os.path.join(STATIC_DIR, "about-us.html"))

@app.get("/blog.html", response_class=FileResponse)
@app.get("/blog", response_class=FileResponse)
async def serve_blog():
    return FileResponse(os.path.join(STATIC_DIR, "blog.html"))

@app.get("/manifest.json", response_class=FileResponse)
async def serve_manifest():
    return FileResponse(os.path.join(STATIC_DIR, "manifest.json"))

@app.get("/sw.js", response_class=FileResponse)
async def serve_sw():
    return FileResponse(os.path.join(STATIC_DIR, "sw.js"))

@app.get("/robots.txt", response_class=FileResponse)
async def serve_robots():
    return FileResponse(os.path.join(STATIC_DIR, "robots.txt"))

@app.get("/script.js", response_class=FileResponse)
async def serve_script_alias():
    return FileResponse(os.path.join(STATIC_DIR, "js", "app.js"))
