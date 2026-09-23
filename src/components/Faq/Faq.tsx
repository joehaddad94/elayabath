import { OpenTargetedQuestion } from "./OpenTargetedQuestion";
import styles from "./Faq.module.css";

export interface QandA {
  q: string;
  a: string;
}

/**
 * Turns a question into a URL fragment.
 *
 * Stable across builds because it is derived from the question text rather
 * than an index: inserting a question at the top must not silently retarget
 * every link anyone has already sent.
 */
export function questionId(question: string): string {
  return (
    "q-" +
    question
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
  );
}

export function Faq({ items, permalinkLabel }: { items: readonly QandA[]; permalinkLabel: string }) {
  return (
    <div className={styles.faq}>
      <OpenTargetedQuestion />
      {items.map((item) => {
        const id = questionId(item.q);
        return (
          <details key={item.q} id={id}>
            <summary>{item.q}</summary>
            <div className={styles.answer}>
              <p>{item.a}</p>
              {/* In the answer rather than the summary: an anchor inside a
                  summary is an interactive element nested in another one,
                  which is invalid and unusable with a keyboard. */}
              <a className={styles.permalink} href={`#${id}`}>
                {permalinkLabel}
              </a>
            </div>
          </details>
        );
      })}
    </div>
  );
}
