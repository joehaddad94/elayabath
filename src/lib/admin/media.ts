/**
 * Media rules shared by the browser (uploading) and the server (checking what
 * a save claims).
 *
 * Every upload gets a fresh name inside its product's folder. Files are
 * served with a year-long cache, so a replaced photo must be a new address,
 * never the old one overwritten; and the product id (not its web address,
 * which can change) keeps the folder stable for the product's whole life.
 */

export function uploadFolder(productId: string): string {
  return `products/${productId}/`;
}

/** Swatches live in the swatches bucket, one folder per finish. */
export function swatchFolder(finishId: string): string {
  return `finishes/${finishId}/`;
}

/** Swatches are shown small; 256px covers a large-screen retina tile. */
export const MAX_SWATCH_EDGE = 256;

/** Storage on Supabase's free plan. Shown on the meter so there is warning
 *  well before uploads start failing; change it here if the plan changes. */
export const STORAGE_QUOTA_BYTES = 1024 ** 3;

/** The long edge photos are reduced to before upload. The site shows them at
 *  up to about 800px, so this leaves room for sharp zoom on a large screen. */
export const MAX_PHOTO_EDGE = 1600;

/** The bucket limits from the storage migration. */
export const MAX_PHOTO_BYTES = 10 * 1024 ** 2;
export const MAX_DATASHEET_BYTES = 50 * 1024 ** 2;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
  extension: "webp" | "jpg";
}

/**
 * Reduces a photo in the browser before it is uploaded: a phone photo of
 * 4 to 12 MB becomes a few hundred KB, which is faster to send, cheaper to
 * store and what the site would have to produce anyway.
 *
 * WebP where the browser can write it; some Safari versions can only write
 * JPEG, and `toBlob` then quietly returns PNG, so the result is checked and
 * JPEG used instead. The photo's own orientation is applied, so a portrait
 * phone photo stays upright.
 */
export async function preparePhoto(file: File, maxEdge = MAX_PHOTO_EDGE): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      `${file.name} can't be read here. Save it as JPEG or PNG and try again (iPhone HEIC photos included).`,
    );
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare photos for upload.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return { blob: webp, width, height, extension: "webp" };
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error(`${file.name} couldn't be prepared for upload.`);
  return { blob: jpeg, width, height, extension: "jpg" };
}
