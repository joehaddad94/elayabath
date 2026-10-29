"use client";

import Image from "next/image";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { productPhotos, type Photo } from "./actions";
import styles from "./photos.module.css";

export interface PhotoProduct {
  id: string;
  name: string;
  sku: string;
  /** The row's thumbnail, shown at once while the rest of the gallery loads. */
  thumb: string;
}

/** A swipe is a sideways drag at least this long, in CSS pixels. */
const SWIPE_MIN = 48;

/**
 * One product's photos, large, over the list. Arrow keys, the on-screen
 * arrows or a sideways swipe go through them; Escape, the close button or a
 * tap on the dark area around the photo closes it. Built on Radix's Dialog,
 * so focus stays inside while it is open and returns to the row after.
 */
export function PhotoViewer({ product, onClose }: { product: PhotoProduct | null; onClose: () => void }) {
  return (
    <Dialog.Root open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        {/* Keyed by product, so each one opens on its first photo. */}
        {product && <Viewer key={product.id} product={product} onClose={onClose} />}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Viewer({ product, onClose }: { product: PhotoProduct; onClose: () => void }) {
  const [photos, setPhotos] = useState<Photo[]>(() => [{ url: product.thumb, alt: "", width: null, height: null }]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    let current = true;
    productPhotos(product.id)
      .then((list) => current && list.length > 0 && setPhotos(list))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [product.id]);

  const count = photos.length;
  const step = useCallback(
    (by: number) => setIndex((i) => (count > 1 ? (i + by + count) % count : 0)),
    [count],
  );

  const photo = photos[Math.min(index, count - 1)];

  return (
    <Dialog.Content
      className={styles.viewer}
      aria-describedby={undefined}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
        else return;
        e.preventDefault();
      }}
    >
      <div className={styles.bar}>
        <Dialog.Title className={styles.title}>
          {product.name} <span className={styles.sku}>{product.sku}</span>
        </Dialog.Title>
        {count > 1 && (
          <span className={styles.counter} aria-live="polite">
            {index + 1} of {count}
          </span>
        )}
        <Link href={`/admin/products/${product.id}`} className={styles.edit}>
          Edit product
        </Link>
        <Dialog.Close className={styles.close} aria-label="Close">
          ×
        </Dialog.Close>
      </div>

      {/* The stage: a tap on its empty space closes, a sideways drag
          moves to the next or previous photo. */}
      <div
        className={styles.stage}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerUp={(e) => {
          const start = swipe.current;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
            start.moved = true;
            step(dx < 0 ? 1 : -1);
          }
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        onClick={(e) => {
          const moved = swipe.current?.moved;
          swipe.current = null;
          if (!moved && e.target === e.currentTarget) onClose();
        }}
      >
        {photo && (
          // Sized to the photo itself, not the stage, so a tap beside it
          // lands on the stage and closes.
          <Image
            key={photo.url}
            src={photo.url}
            alt={photo.alt || product.name || ""}
            width={photo.width ?? 1200}
            height={photo.height ?? 1200}
            sizes="(max-width: 1200px) 100vw, 1200px"
            className={styles.photo}
            draggable={false}
          />
        )}
        {count > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.prev}`} aria-label="Previous photo" onClick={() => step(-1)}>
              ‹
            </button>
            <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label="Next photo" onClick={() => step(1)}>
              ›
            </button>
          </>
        )}
      </div>

      {failed && <p className={styles.note}>The other photos couldn&rsquo;t be loaded. Close and try again.</p>}
    </Dialog.Content>
  );
}

/** How long the pointer rests on a thumbnail before the preview shows. */
const HOVER_DELAY_MS = 500;
const PREVIEW_SIZE = 240;

/**
 * The medium preview a mouse gets by resting on a thumbnail. Only for a
 * mouse or trackpad: on a touch screen a tap opens the viewer instead.
 * Drawn on the page body, so the grid's own scrolling boxes don't clip it.
 */
export function useHoverPreview() {
  const [preview, setPreview] = useState<{ url: string; rect: DOMRect } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPreview(null);
  }, []);

  const show = useCallback(
    (url: string, element: HTMLElement, pointerType: string) => {
      if (pointerType !== "mouse" || !window.matchMedia("(hover: hover)").matches) return;
      hide();
      timer.current = setTimeout(() => setPreview({ url, rect: element.getBoundingClientRect() }), HOVER_DELAY_MS);
    },
    [hide],
  );

  useEffect(() => hide, [hide]);

  // The row it belongs to may scroll away from under it.
  useEffect(() => {
    if (!preview) return;
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [preview, hide]);

  const element =
    preview && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.preview}
            aria-hidden="true"
            style={{
              width: PREVIEW_SIZE,
              height: PREVIEW_SIZE,
              left: Math.min(preview.rect.right + 12, window.innerWidth - PREVIEW_SIZE - 12),
              top: Math.max(12, Math.min(preview.rect.top + preview.rect.height / 2 - PREVIEW_SIZE / 2, window.innerHeight - PREVIEW_SIZE - 12)),
            }}
          >
            <Image src={preview.url} alt="" fill sizes={`${PREVIEW_SIZE}px`} className={styles.previewPhoto} />
          </div>,
          document.body,
        )
      : null;

  return { show, hide, element };
}
