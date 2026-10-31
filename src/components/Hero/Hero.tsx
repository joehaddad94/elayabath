import Image from "next/image";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs/Breadcrumbs";
import type { ReactNode } from "react";
import { Container } from "@/components/Container/Container";
import { Divider } from "@/components/Divider/Divider";
import styles from "./Hero.module.css";

export interface HeroProps {
  title: string;
  /** Described from what is visibly in the photograph. The source has no alt
   *  text for any of its background imagery, because it has no img tags. */
  image: { src: string; alt: string; width: number; height: number };
  /** Shown above the title, inside the photograph. An inner page that opens
   *  on a photograph still has to say where it sits in the site; without
   *  this, swapping PageHead for Hero would silently drop the trail. */
  crumbs?: Crumb[];
  crumbLabel?: string;
  lede?: ReactNode;
  actions?: ReactNode;
  /** Inner pages get a shorter band than the homepage. */
  compact?: boolean;
  /** Content below the band, in normal flow. */
  children?: ReactNode;
  /** Sets the title as the brand's tagline: Cormorant italic, per the brand
   *  guidelines. */
  tagline?: boolean;
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
  crumbs,
  crumbLabel,
  lede,
  actions,
  compact = false,
  children,
  tagline = false,
}: HeroProps) {
  return (
    <section className={`${styles.hero} ${compact ? styles.small : ""}`}>
      {/* Text first, on the cream ground, and the photograph after it with
          nothing laid over it. The text used to sit on the photograph behind
          a dark gradient veil; photographs are now shown clean, and on a
          plain ground the text's contrast is the palette's own. */}
      <Container className={styles.inner}>
        {crumbs && crumbLabel && (
          <div className={styles.crumbs}>
            <Breadcrumbs label={crumbLabel} items={crumbs} />
          </div>
        )}
        <h1 className={tagline ? styles.tagline : undefined}>{title}</h1>
        {lede && <p className={styles.lede}>{lede}</p>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </Container>

      <figure className={styles.plate}>
        <Image
          className={styles.shot}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          priority
          sizes="100vw"
        />
      </figure>

      <Divider />

      {children && <Container className={styles.under}>{children}</Container>}
    </section>
  );
}
