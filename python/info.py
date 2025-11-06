from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
import yt_dlp

app = FastAPI(docs_url=None, redoc_url=None)

@app.get("/")
async def root():
    return {"message": "Hello World"}
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