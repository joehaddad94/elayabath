import styles from "./PreviewBanner.module.css";

/**
 * Shown across a product page opened in preview, so a hidden product is never
 * mistaken for the live page. Staff-facing, so English only, like the
 * dashboard.
 */
export function PreviewBanner({ productId }: { productId: string }) {
  return (
    <div className={styles.banner} role="status">
      <p>
        <strong>Preview.</strong> The saved copy, shown only to staff. A hidden product stays off the site for everyone else.
      </p>
      <form method="post" action="/admin/preview/exit" className={styles.actions}>
        <input type="hidden" name="product" value={productId} />
        <a href={`/admin/products/${productId}`}>Back to the editor</a>
        <button type="submit">Leave preview</button>
      </form>
    </div>
  );
}
