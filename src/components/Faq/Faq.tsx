import styles from "./Faq.module.css";

export interface QandA {
  q: string;
  a: string;
}

export function Faq({ items }: { items: readonly QandA[] }) {
  return (
    <div className={styles.faq}>
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <div className={styles.answer}>
            <p>{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
