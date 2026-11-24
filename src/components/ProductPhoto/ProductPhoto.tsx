"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { readFinish } from "@/lib/product-finish";
import type { ProductImage } from "@/lib/types";
import { getSearch, getServerSearch, subscribeToSearch } from "@/lib/url-filters";

/**
 * The product page's main photo, following the finish picker: a finish with
 * its own photo shows it, any other finish (or none chosen) the main photo.
 *
 * Reads the same URL value the picker writes, so a link to "this basin, in
 * Thunder" opens on the Thunder photo too. The server renders the main
 * photo, which stays the page's priority image.
 */
export function ProductPhoto({
  image,
  finishPhotos,
  sizes,
  noPhoto,
}: {
  image: ProductImage | null;
  /** Finish slug to its photo, only for finishes that have one. */
  finishPhotos: Record<string, { src: string; alt: string }>;
  sizes: string;
  /** Shown when there is no photo to show. */
  noPhoto: React.ReactNode;
}) {
  const search = useSyncExternalStore(subscribeToSearch, getSearch, getServerSearch);
  const finish = readFinish(search);
  const photo = finish ? finishPhotos[finish] : undefined;

  if (photo) {
    // Stored without dimensions; the frame is square and the photo contained
    // in it, so a square box is the right reservation.
    return <Image key={photo.src} src={photo.src} alt={photo.alt} width={800} height={800} sizes={sizes} />;
  }
  if (!image) return noPhoto;
  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      priority
    />
  );
}
