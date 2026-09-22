import Image from "next/image";
import type { ReactNode } from "react";
import { Marks } from "@/components/Blueprint/Blueprint";
import { Container } from "@/components/Container/Container";
import styles from "./Hero.module.css";

export interface HeroProps {
  title: string;
  /** Described from what is visibly in the photograph. The source has no alt
   *  text for any of its background imagery, because it has no img tags. */
  image: { src: string; alt: string; width: number; height: number };
  lede?: ReactNode;
  actions?: ReactNode;
  /** Inner pages get a shorter band than the homepage. */
  compact?: boolean;
  /** Content below the band, in normal flow. */
  children?: ReactNode;
}

/**
 * The photograph is never duotoned, which is a deliberate departure from the
 * design system. The system washes every image into its accent; this brand
 * sells Polished Brass, Rose Gold, Polished Copper, Chrome and Matt Black,
 * and tinting the one attribute the buyer is choosing would be an own goal.
 */
export function Hero({
  title,
  image,
  lede,
  actions,
  compact = false,
  children,
}: HeroProps) {
  return (
    <section className={styles.hero}>
      <figure className={`${styles.plate} ${compact ? styles.small : ""} blueprint`}>
        <Image
          className={styles.shot}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          priority
          sizes="100vw"
        />
        <div className={styles.veil} />

        {/* Text here sits over a photograph, not a painted background, so
            its contrast is governed by the two-layer veil above and has to be
            measured against composited pixels rather than a CSS colour. The
            attribute marks it so an automated colour audit does not report a
            false failure by reading --color-bg underneath. */}
        <Container className={styles.inner} data-over-photo="">
          <h1>{title}</h1>
          {lede && <p className={styles.lede}>{lede}</p>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </Container>

        <Marks />
      </figure>

      {children && <Container className={styles.under}>{children}</Container>}
    </section>
  );
}
