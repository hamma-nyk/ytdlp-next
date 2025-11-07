import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import queryString from "query-string";
// import nodeFetch, { Response as NodeFetchResponse } from "node-fetch";
import fs from "fs";
import crypto from "crypto";

export const runtime = "nodejs"; // Penting: agar pakai Node.js runtime, bukan Edge

// === Interface untuk response dari FastAPI ===
interface YoutubeFormat {
  url: string;
}

interface YoutubeInfo {
  entries?: unknown;
  acodec?: string;
  vcodec?: string;
  requested_formats?: YoutubeFormat[];
  title?: string;
  url?: string;
  filesize?: number;
  bytes?: number;
  duration?: number;
}

// === API Handler ===
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const format = searchParams.get("format");

  if (!url) {
    return new Response('"url" parameter required.', { status: 400 });
  }

  try {
    const PY_API = process.env.PY_API || "http://127.0.0.1:8000";
    let infoRes: Response;

    if (format === "mp4") {
      infoRes = await fetch(
        `${PY_API}/api/vinfo?${queryString.stringify({
          url: url,
        })}`
      );
    } else if (format === "mp3") {
      infoRes = await fetch(
        `${PY_API}/api/ainfo?${queryString.stringify({
          url: url,
        })}`
      );
    } else {
      infoRes = await fetch(
        `${PY_API}/api/ainfo?${queryString.stringify({
          url: url,
        })}`
      );
    }

    if (!infoRes.ok) {
      const text = await infoRes.text();
      return new Response(text, { status: 400 });
    }

    const info = (await infoRes.json()) as YoutubeInfo;

    if (info.entries) {
      return new Response("does not support playlists", { status: 400 });
    }

    const hasAudio = info.acodec && info.acodec !== "none";
    const hasVideo = info.vcodec && info.vcodec !== "none";
    const audioOnly = hasAudio && !hasVideo;

    if (!hasAudio && hasVideo) {
      return new Response("only video, no audio", { status: 400 });
    }

    const mainUrl =
      info.url ||
      info.requested_formats?.[0]?.url ||
      info.requested_formats?.[1]?.url;

    if (!mainUrl) {
      return new Response("No valid stream URL found", { status: 400 });
    }

    // === Gabungkan video dan audio stream ===
    let ffmpegArgs: string[] = [];
    const outputExt = audioOnly ? "mp3" : "mp4";

    // const outputFile = path.join(
    //   process.cwd(),
    //   "public",
    //   `${crypto.randomUUID()}.${outputExt}`
    // );

    const fileId = crypto.randomUUID();
    const outputFile = path.join("/tmp", `${fileId}.${outputExt}`);

    if (audioOnly) {
      ffmpegArgs = [
        "-i",
        mainUrl,
        "-acodec",
        "libmp3lame",
        "-f",
        "mp3",
        outputFile,
      ];
    } else {
      let videoUrl: string | undefined;
      let audioUrl: string | undefined;

      if (
        Array.isArray(info.requested_formats) &&
        info.requested_formats.length >= 2
      ) {
        const videoCandidate = info.requested_formats.find(
          (f: any) => f.vcodec && f.vcodec !== "none"
        );
        const audioCandidate = info.requested_formats.find(
          (f: any) => f.acodec && f.acodec !== "none"
        );

        // Fallback kalau codec tidak ada
        videoUrl = videoCandidate?.url || info.requested_formats[0]?.url;
        audioUrl = audioCandidate?.url || info.requested_formats[1]?.url;
      }

      if (videoUrl && audioUrl && videoUrl !== audioUrl) {
        // Jika audio & video terpisah → gabungkan
        ffmpegArgs = [
          "-i",
          videoUrl,
          "-i",
          audioUrl,
          "-c:v",
          "libx264",
          "-acodec",
          "aac",
          "-movflags",
          "frag_keyframe+empty_moov",
          "-f",
          "mp4",
          outputFile,
        ];
      } else {
        // Jika hanya satu URL (gabung langsung)
        ffmpegArgs = [
          "-i",
          mainUrl,
          "-c:v",
          "libx264",
          "-acodec",
          "aac",
          "-movflags",
          "frag_keyframe+empty_moov",
          "-f",
          "mp4",
          outputFile,
        ];
      }
    }

    // local
    // const projectRoot = process.cwd();
    // const ffmpegPath = path.resolve(
    //   projectRoot,
    //   "node_modules/ffmpeg-static/ffmpeg.exe"
    // );
    // const ffmpegPath = ".\\node_modules\\ffmpeg-static\\ffmpeg";

    try {
      const ff = spawn("./node_modules/ffmpeg-static/ffmpeg", ffmpegArgs, {
        stdio: "pipe",
      });
      console.log(ffmpegArgs);
      await new Promise<void>((resolve, reject) => {
        ff.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}`));
        });
      });

      if (!fs.existsSync(outputFile)) {
        return new Response("FFmpeg failed to produce output", { status: 500 });
      }

      return Response.json({
        success: true,
        title: info.title || "video",
        url: "/tmp/" + path.basename(outputFile),
      });
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : JSON.stringify(error, null, 2),
        { status: 500 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error, null, 2);
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
