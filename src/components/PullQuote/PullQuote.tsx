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
  // The text is editable in Site content, so the emphasised word may no
  // longer be in it: then nothing is emphasised, rather than the word being
  // added to the end.
  const at = emphasise ? text.indexOf(emphasise) : -1;
  const before = at < 0 ? text : text.slice(0, at);
  const after = at < 0 ? "" : text.slice(at + emphasise!.length);

  return (
    <div className={styles.quote}>
      <blockquote>
        {before}
        {at >= 0 && <em>{emphasise}</em>}
        {after}
      </blockquote>
      <cite className={styles.cite}>{attribution}</cite>
    </div>
  );
}
