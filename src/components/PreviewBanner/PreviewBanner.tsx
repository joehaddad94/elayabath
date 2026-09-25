import styles from "./PreviewBanner.module.css";

/**
 * Shown across a product page opened in preview, so a draft is never
 * mistaken for the live page. Staff-facing, so English only, like the
 * dashboard.
 */
export function PreviewBanner({ productId }: { productId: string }) {
  return (
    <div className={styles.banner} role="status">
      <p>
        <strong>Preview.</strong> This is the saved draft. Visitors still see the published page.
      </p>
      <form method="post" action="/admin/preview/exit" className={styles.actions}>
        <input type="hidden" name="product" value={productId} />
        <a href={`/admin/products/${productId}`}>Back to the editor</a>
        <button type="submit">Leave preview</button>
      </form>
    </div>
  );
}
