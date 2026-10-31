import styles from "./Divider.module.css";

/**
 * The brand's thin champagne curved divider, a soft wave echoing the one under
 * the logo. The brand guidelines allow at most one per page, so it lives in the
 * two components a page opens with (Hero and PageHead) and nowhere else.
 *
 * Decorative only: champagne is 1.43:1 on cream, so it never carries meaning.
 */
export function Divider({ className }: { className?: string }) {
  return (
    <svg
      className={`${styles.divider} ${className ?? ""}`}
      viewBox="0 0 240 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12 C 60 2, 120 2, 160 8 S 220 12, 238 4" />
    </svg>
  );
}
