import { NextRequest } from "next/server";
import { execa } from "execa";
import path from "path";
import queryString from "query-string";
import fetch from "node-fetch";
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

    const infoRes = await fetch(
      `${PY_API}/api/info?${queryString.stringify({
        url: url,
        format: format,
      })}`
    );

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

    const ffmpegArgs: string[] = ["-i", mainUrl];

    const outputExt = audioOnly ? "mp3" : "mp4";

    // const outputFile = path.join(
    //   process.cwd(),
    //   "public",
    //   `${crypto.randomUUID()}.${outputExt}`
    // );

    const fileId = crypto.randomUUID();
    const outputFile = path.join("/tmp", `${fileId}.${outputExt}`);

    if (audioOnly) {
      ffmpegArgs.push("-acodec", "libmp3lame", "-f", "mp3", outputFile);
    } else {
      if (info.requested_formats && info.requested_formats[1]) {
        ffmpegArgs.push("-i", info.requested_formats[1].url);
      }
      ffmpegArgs.push(
        "-c:v",
        "libx264",
        "-acodec",
        "aac",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        outputFile
      );
    }

    const projectRoot = process.cwd();
    const ffmpegPath = path.resolve(
      projectRoot,
      "node_modules/ffmpeg-static/ffmpeg.exe"
    );

    try {
      const ff = execa(ffmpegPath, ffmpegArgs, {
        stdout: "pipe",
        stderr: "pipe",
        shell: false,
        windowsHide: true,
      });
      await ff;

      if (!fs.existsSync(outputFile)) {
        return new Response("FFmpeg failed to produce output", { status: 500 });
      }

      return Response.json({
        success: true,
        title: info.title || "video",
        url: "/" + path.basename(outputFile),
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
