import styles from "../admin.module.css";

/** A turning ring for a button whose action is running. Decorative: the
 *  button's own text says what is happening ("Saving"). */
export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}
