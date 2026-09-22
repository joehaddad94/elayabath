import type { ElementType, ReactNode } from "react";
import styles from "./Container.module.css";

/** The measure every page is set to. One place, so it cannot drift. */
export function Container({
  as: Tag = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      {children}
    </Tag>
  );
}

/** A vertical band of the page. Adjacent bands get a hairline between them. */
export function Section({
  className,
  tight = false,
  children,
  id,
}: {
  className?: string;
  tight?: boolean;
  children: ReactNode;
  id?: string;
}) {
  const cls = [styles.section, tight ? styles.tight : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <section id={id} className={cls}>
      {children}
    </section>
  );
}
