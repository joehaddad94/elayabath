"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  MAX_DATASHEET_BYTES,
  MAX_PHOTO_BYTES,
  formatBytes,
  preparePhoto,
  uploadFolder,
} from "@/lib/admin/media";
import type { ProductImage } from "@/lib/admin/product-schema";
import { browserClient } from "@/lib/supabase/browser";
import { storageUrl } from "@/lib/supabase/config";
import { Icon } from "@/components/Icon/Icon";
import { Spinner } from "../../Spinner";
import styles from "./editor.module.css";

type Images = ProductImage[];

/** Year-long caching is safe because every upload has a new name. */
const CACHE = "31536000";

/**
 * The product's photographs, in the order the site shows them; the first is
 * the main photo on cards and at the top of the page.
 *
 * Files go straight from the browser to Storage, reduced first, and join the
 * gallery here. They become part of the product only when it is saved, like
 * every other change, so an upload followed by "never mind" leaves nothing
 * on the product; the unused file is cleared later from the Media page.
 */
export function Gallery({
  productId,
  images,
  defaultAlt,
  onChange,
}: {
  productId: string;
  images: Images;
  defaultAlt: string;
  onChange: (update: (current: Images) => Images) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  const upload = async (files: File[]) => {
    const photos = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const refused = files.filter((f) => !photos.includes(f)).map((f) => `${f.name} isn't a photograph.`);
    setProblems(refused);
    const client = browserClient();
    for (const [index, file] of photos.entries()) {
      setProgress(`Preparing and uploading ${index + 1} of ${photos.length}`);
      try {
        const photo = await preparePhoto(file);
        if (photo.blob.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} is still over ${formatBytes(MAX_PHOTO_BYTES)} after reducing it.`);
        const path = `${uploadFolder(productId)}${crypto.randomUUID()}.${photo.extension}`;
        const { error } = await client.storage
          .from("product-media")
          .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: CACHE, upsert: false });
        if (error) throw new Error(`${file.name} couldn't be uploaded: ${error.message}`);
        onChange((current) => [
          ...current,
          { path, alt: defaultAlt, caption: null, width: photo.width, height: photo.height },
        ]);
      } catch (e) {
        setProblems((p) => [...p, e instanceof Error ? e.message : `${file.name} couldn't be uploaded.`]);
      }
    }
    setProgress(null);
  };

  const move = (from: number, to: number) =>
    onChange((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });

  const edit = (path: string, patch: Partial<ProductImage>) =>
    onChange((current) => current.map((i) => (i.path === path ? { ...i, ...patch } : i)));

  return (
    <div className={styles.media}>
      {images.length > 0 && (
        <ol className={styles.photos}>
          {images.map((image, index) => (
            <li key={image.path} className={styles.photoItem}>
              <Image
                src={storageUrl("product-media", image.path)}
                alt=""
                width={96}
                height={96}
                className={styles.thumb}
              />
              <div className={styles.photoFields}>
                <p className={styles.photoRole}>
                  {index === 0 ? "Main photo" : `Photo ${index + 1}`}
                  {image.alt.trim() === "" && <span className={styles.flag}> · no alt text</span>}
                </p>
                <label className={styles.label}>
                  Alt text
                  <input
                    className="input"
                    value={image.alt}
                    onChange={(e) => edit(image.path, { alt: e.target.value })}
                    placeholder="What the photo shows, for people who can't see it"
                  />
                </label>
                <label className={styles.label}>
                  Caption
                  <input
                    className="input"
                    value={image.caption ?? ""}
                    onChange={(e) => edit(image.path, { caption: e.target.value || null })}
                    placeholder="Optional, shown under the photo"
                  />
                </label>
              </div>
              <div className={styles.photoButtons}>
                {index > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={() => move(index, 0)}>
                    Make main
                  </button>
                )}
                <span className={styles.rowButtons}>
                  <button type="button" className="btn btn-icon btn-secondary" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move photo ${index + 1} earlier`}>
                    <Icon name="arrowUp" />
                  </button>
                  <button type="button" className="btn btn-icon btn-secondary" disabled={index === images.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move photo ${index + 1} later`}>
                    <Icon name="arrowDown" />
                  </button>
                  <button type="button" className="btn btn-icon btn-secondary" onClick={() => onChange((current) => current.filter((i) => i.path !== image.path))} aria-label={`Remove photo ${index + 1}`}>
                    <Icon name="close" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div
        className={`${styles.drop} ${over ? styles.dropOver : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          // One batch at a time, as the button allows.
          if (progress === null) void upload([...e.dataTransfer.files]);
        }}
      >
        <button type="button" className="btn btn-secondary" disabled={progress !== null} onClick={() => input.current?.click()}>
          {progress !== null && <Spinner />}
          {progress !== null ? "Uploading" : "Add photographs"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          aria-label="Photographs to upload"
          onChange={(e) => {
            void upload([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <span className={styles.hint}>or drop them here. Large photos are reduced before upload.</span>
      </div>
      <p className={styles.hint} role="status">
        {progress}
      </p>
      {problems.length > 0 && (
        <ul className={styles.problems} role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The product's data sheet: one PDF, replaced or removed when the product is saved. */
export function Datasheet({
  productId,
  path,
  onChange,
}: {
  productId: string;
  path: string | null;
  onChange: (path: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setProblem(`${file.name} isn't a PDF.`);
      return;
    }
    if (file.size > MAX_DATASHEET_BYTES) {
      setProblem(`${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_DATASHEET_BYTES)}.`);
      return;
    }
    setBusy(true);
    const next = `${uploadFolder(productId)}${crypto.randomUUID()}.pdf`;
    const { error } = await browserClient()
      .storage.from("datasheets")
      .upload(next, file, { contentType: "application/pdf", cacheControl: CACHE, upsert: false });
    setBusy(false);
    if (error) setProblem(`It couldn't be uploaded: ${error.message}`);
    else onChange(next);
  };

  return (
    <div className={styles.datasheet}>
      {path ? (
        <a href={storageUrl("datasheets", path)} target="_blank" rel="noreferrer">
          Open the data sheet (PDF)
        </a>
      ) : (
        <span className={styles.hint}>No data sheet.</span>
      )}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <><Spinner />Uploading</> : path ? "Replace" : "Upload a PDF"}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        aria-label="Data sheet to upload"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {path && (
        <button type="button" className="btn btn-secondary" onClick={() => onChange(null)}>
          Remove
        </button>
      )}
      {problem && (
        <p className={styles.problems} role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
