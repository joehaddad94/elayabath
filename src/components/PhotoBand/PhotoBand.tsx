import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "@/components/Container/Container";
import styles from "./PhotoBand.module.css";

/**
 * A full-bleed photograph breaking a long page.
 *
 * Tone shifts between ground, band and surface separate one block from the
 * next, but they all still read as the same material. A photograph is a
 * different kind of thing entirely, which is why one of these does more for a
 * monotone page than any number of five-percent adjustments.
 *
 * Shorter than the hero on purpose: this is a breath between sections, not a
 * second opening. It also carries an action, so the break earns its height
 * rather than being decoration.
 *
 * No .duotone, for the same reason as everywhere else on this site: the
 * finishes are what the buyer is choosing.
 */
export function PhotoBand({
  image,
  label,
  heading,
  actions,
}: {
  image: { src: string; alt: string; width: number; height: number };
  label?: string;
  heading: string;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.band}>
      <figure className={`${styles.plate} blueprint`}>
        <Image
          className={styles.shot}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="100vw"
        />

        {/* Text sits directly on the photograph with no overlay, by decision
            (2026-10-31). Marked so the colour audit measures composited
            pixels. */}
        <Container className={styles.inner} data-over-photo="">
          {label && <span className={styles.label}>{label}</span>}
          <p className={styles.heading}>{heading}</p>
          {actions && <div className={styles.actions}>{actions}</div>}
        </Container>
      </figure>
    </section>
  );
}
