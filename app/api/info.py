import yt_dlp
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import shutil
import os

app = FastAPI(docs_url=None, redoc_url=None)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return PlainTextResponse(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

@app.get("/api/ainfo")
async def get_info(url: str):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    COOKIE_SRC = os.path.join(BASE_DIR, "cookies.txt")
    TMP_COOKIE = "/tmp/cookies.txt"
    # TMP_COOKIE = "cookies.txt"

    if os.path.exists(COOKIE_SRC):
        shutil.copy(COOKIE_SRC, TMP_COOKIE)
    else:
        print("[WARN] cookies.txt not found — continuing without it")
    
    try:
        with yt_dlp.YoutubeDL({"format": "bestaudio/best", "cookiefile": TMP_COOKIE}) as ydl:
            info = ydl.extract_info(url, download=False)
            return JSONResponse(info)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
@app.get("/api/vinfo")
async def get_info(url: str):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    COOKIE_SRC = os.path.join(BASE_DIR, "cookies.txt")
    TMP_COOKIE = "/tmp/cookies.txt"
    # TMP_COOKIE = "cookies.txt"

    if os.path.exists(COOKIE_SRC):
        shutil.copy(COOKIE_SRC, TMP_COOKIE)
    else:
        print("[WARN] cookies.txt not found — continuing without it")
        
    try:
        with yt_dlp.YoutubeDL({"format": "bestvideo[height<=480]+bestaudio/best", "cookiefile": TMP_COOKIE}) as ydl:
            info = ydl.extract_info(url, download=False)
            return JSONResponse(info)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))