import styles from "./PullQuote.module.css";

/**
 * The brand's own voice, verbatim, landing early. The emphasis falls on the
 * last word because that is where the client put it: the capital M in "Myth"
 * is theirs, not a typo to fix.
 */
export function PullQuote({
  text,
  attribution,
  emphasise,
}: {
  text: string;
  attribution: string;
  emphasise?: string;
}) {
  const [before, after] = emphasise ? text.split(emphasise) : [text, ""];

  return (
    <div className={styles.quote}>
      <blockquote>
        {before}
        {emphasise && <em>{emphasise}</em>}
        {after}
      </blockquote>
      <cite className={styles.cite}>{attribution}</cite>
    </div>
  );
}
