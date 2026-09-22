import styles from "./SectionHead.module.css";

export function SectionHead({
  index,
  label,
  count,
}: {
  index?: string;
  label: string;
  count?: string;
}) {
  return (
    <div className={styles.head}>
      {index && <span className={styles.no}>{index}</span>}
      <h2 className={styles.label}>{label}</h2>
      {count && <span className={styles.count}>{count}</span>}
    </div>
  );
}
