import yt_dlp
import yt_dlp
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
app = FastAPI(docs_url=None, redoc_url=None)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return PlainTextResponse(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
@app.get("/api/info")
async def get_info(url: str, format: str):
    if format == "audio":
        yt_dlp_formats = "bestaudio/best"
    elif format == "video":
        yt_dlp_formats = "bestvideo+bestaudio/best"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid format")
    try:
        with yt_dlp.YoutubeDL({"format": yt_dlp_formats, "cookiefile": "cookies.txt"}) as ydl:
            info = ydl.extract_info(url, download=False)
            return JSONResponse(info)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))