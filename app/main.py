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

# Page Routes for SEO and Multi-Mode Support
@app.get("/", response_class=FileResponse)
async def serve_home():
    return FileResponse(os.path.join(BASE_DIR, "index.html") if os.path.exists(os.path.join(BASE_DIR, "index.html")) else os.path.join(STATIC_DIR, "index.html"))

@app.get("/reels/", response_class=FileResponse)
@app.get("/reels", response_class=FileResponse)
async def serve_reels():
    return FileResponse(os.path.join(BASE_DIR, "reels.html") if os.path.exists(os.path.join(BASE_DIR, "reels.html")) else os.path.join(STATIC_DIR, "reels.html"))

@app.get("/audio/", response_class=FileResponse)
@app.get("/audio", response_class=FileResponse)
async def serve_audio():
    return FileResponse(os.path.join(BASE_DIR, "audio.html") if os.path.exists(os.path.join(BASE_DIR, "audio.html")) else os.path.join(STATIC_DIR, "audio.html"))

@app.get("/photo/", response_class=FileResponse)
@app.get("/photo", response_class=FileResponse)
async def serve_photo():
    return FileResponse(os.path.join(BASE_DIR, "photo.html") if os.path.exists(os.path.join(BASE_DIR, "photo.html")) else os.path.join(STATIC_DIR, "photo.html"))
