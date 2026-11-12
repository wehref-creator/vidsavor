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

    # If GET request: resolve to the corresponding html page
    clean = catch_all.strip("/").replace(".html", "")
    target = f"{clean}.html"
    for folder in [BASE_DIR, STATIC_DIR]:
        candidate = os.path.join(folder, target)
        if os.path.exists(candidate):
            return serve_html_file(target)
    # Default fallback to home
    return serve_html_file("index.html")
