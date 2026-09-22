import styles from "./SpecPlate.module.css";

export function SpecPlate({
  intro,
  items,
  foot,
}: {
  intro: string;
  items: readonly string[];
  foot: string;
}) {
  return (
    <div className={styles.plate}>
      <p className={styles.intro}>{intro}</p>
      <ol className={styles.list}>
        {items.map((item) => (
          <li key={item} className={styles.item}>
            {item}
          </li>
        ))}
      </ol>
      <p className={styles.foot}>{foot}</p>
    </div>
  );
}
