import type { ReactNode } from "react";
import styles from "./Note.module.css";

export function Note({
  label,
  children,
  spaced = true,
}: {
  label: string;
  children: ReactNode;
  spaced?: boolean;
}) {
  return (
    <div className={`${styles.note} ${spaced ? styles.spaced : ""} blueprint`}>
      <b className={styles.label}>{label}</b>
      {children}
    </div>
  );
}
