import styles from "./SectionHead.module.css";

/** A section's index, label and count, with an optional one-line caption
 *  under the rule for a caveat that applies to the whole section. */
export function SectionHead({
  index,
  label,
  count,
  note,
}: {
  index?: string;
  label: string;
  count?: string;
  note?: string;
}) {
  const head = (
    <div className={note ? `${styles.head} ${styles.withNote}` : styles.head}>
      {index && <span className={styles.no}>{index}</span>}
      <h2 className={styles.label}>{label}</h2>
      {count && <span className={styles.count}>{count}</span>}
    </div>
  );
  if (!note) return head;
  return (
    <>
      {head}
      <p className={styles.note}>{note}</p>
    </>
  );
}
