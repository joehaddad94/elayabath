import Image from "next/image";
import type { ReactNode } from "react";
import type { Photo } from "@/lib/imagery";
import styles from "./EditorialBlock.module.css";

/**
 * A contained photograph beside a column of copy.
 *
 * The site had exactly one shape for a photograph: full-bleed. That works for
 * the four wide banners in the archive and nothing else, so the six narrower
 * images were going unused rather than being stretched.
 *
 * This is the placement for those: the image sits in a column around 40rem
 * wide, which a 736px or 817px original covers at native resolution instead
 * of being upscaled across a 1440px viewport.
 *
 * `flip` alternates the side the photograph sits on, so a run of these reads
 * as a rhythm rather than a list.
 */
export function EditorialBlock({
  image,
  label,
  heading,
  children,
  actions,
  flip = false,
}: {
  image: Photo;
  label?: string;
  heading: string;
  children: ReactNode;
  actions?: ReactNode;
  flip?: boolean;
}) {
  return (
    <article className={`${styles.block} ${flip ? styles.flip : ""}`}>
      <div className={styles.copy}>
        {label && <span className={styles.label}>{label}</span>}
        <h2 className={styles.heading}>{heading}</h2>
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      <figure className={`${styles.media} blueprint`}>
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(max-width: 58rem) 100vw, 40rem"
        />
      </figure>
    </article>
  );
}
