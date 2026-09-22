/**
 * Images and documents.
 *
 * Product shots arrive as PNGs sized for a WordPress theme and are re-encoded
 * to WebP at the width the site actually renders them. Technical data sheets
 * are fetched from the live server, politely, because the crawl that produced
 * the archive only followed images and pages, never embedded documents.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { WEBP_QUALITY } from "./config.ts";

const run = promisify(execFile);

export interface ImageResult {
  src: string;
  width: number;
  height: number;
}

async function probeSize(file: string): Promise<{ width: number; height: number }> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0:s=x",
    file,
  ]);
  const [w, h] = stdout.trim().split("x");
  const width = Number(w);
  const height = Number(h);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`could not read dimensions of ${file}`);
  }
  return { width, height };
}

/**
 * Re-encode to WebP, capped at maxWidth. Never upscales: several product
 * shots are smaller than the slot they fill, and stretching them would only
 * make a soft image bigger.
 */
export async function toWebp(
  source: string,
  destination: string,
  maxWidth: number,
): Promise<ImageResult> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", source,
    "-vf", `scale='min(${maxWidth},iw)':-2:flags=lanczos`,
    "-c:v", "libwebp",
    "-quality", String(WEBP_QUALITY),
    "-preset", "photo",
    destination,
  ]);
  const size = await probeSize(destination);
  return { src: "", ...size };
}

/** Their 404 page is served with a 200-shaped body in some cases and is a
 *  known, constant size. Anything HTML is not a PDF. */
function looksLikeHtml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 512).toString("latin1").toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html");
}

export async function fetchDocument(
  url: string,
  destination: string,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (elayabath-ingest)" },
    });
    if (!response.ok) return false;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (looksLikeHtml(buffer)) return false;
    if (!buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) return false;

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, buffer);
    return true;
  } catch {
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
