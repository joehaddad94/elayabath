"use client";

import { useState } from "react";
import styles from "../admin.module.css";
import { useUnsavedGuard } from "./useUnsavedGuard";

/**
 * The bar above an orderable list: says whether the order on screen differs
 * from the live one, and publishes or undoes it. Order is layout, so it goes
 * live on its own, without a draft step for each item.
 */
export function OrderBar({
  changed,
  onPublish,
  onUndo,
}: {
  changed: boolean;
  onPublish: () => Promise<{ ok: boolean; error?: string }>;
  onUndo: () => void;
}) {
  const [busy, setBusy] = useState(false);
  useUnsavedGuard(changed, "The new order isn't published yet. Leave without publishing it?");
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  return (
    <div className={styles.orderBar}>
      <span className={changed ? "" : styles.muted}>
        {changed ? "The order has changed. Visitors see the old order until you publish it." : "This is the order the site shows."}
      </span>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!changed || busy}
        onClick={async () => {
          setBusy(true);
          setNotice(null);
          const result = await onPublish();
          setBusy(false);
          setNotice(result.ok ? { text: "Order published. The site shows it now." } : { text: result.error ?? "It couldn't be published.", error: true });
        }}
      >
        {busy ? "Publishing" : "Publish this order"}
      </button>
      <button type="button" className="btn btn-secondary" disabled={!changed || busy} onClick={onUndo}>
        Undo
      </button>
      {notice && (
        <span role={notice.error ? "alert" : "status"} className={notice.error ? styles.fieldError : ""}>
          {notice.text}
        </span>
      )}
    </div>
  );
}
