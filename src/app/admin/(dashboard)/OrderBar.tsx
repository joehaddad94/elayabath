"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../admin.module.css";
import { useUnsavedGuard } from "./useUnsavedGuard";

/**
 * The line above an orderable list. A new order is saved, and goes live, a
 * moment after the last move, so a few moves in a row make one save. One
 * save runs at a time; a move made during it is saved straight after.
 */
export function OrderBar({
  changed,
  orderKey,
  onSave,
}: {
  changed: boolean;
  /** The order on screen, e.g. its ids joined: a new key means a new move. */
  orderKey: string;
  onSave: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  useUnsavedGuard(changed, "The new order is still being saved.");

  const save = useRef(onSave);
  const running = useRef(false);
  useEffect(() => {
    save.current = onSave;
  });

  useEffect(() => {
    if (!changed) return;
    const timer = setTimeout(async function run() {
      if (running.current) {
        setTimeout(run, 300);
        return;
      }
      running.current = true;
      setBusy(true);
      setNotice(null);
      const result = await save.current();
      running.current = false;
      setBusy(false);
      setNotice(result.ok ? { text: "Order saved. The site shows it now." } : { text: result.error ?? "It couldn't be saved.", error: true });
    }, 800);
    return () => clearTimeout(timer);
  }, [changed, orderKey]);

  return (
    <div className={styles.orderBar}>
      <span className={styles.muted}>Drag to reorder. The site shows the new order as soon as it is saved.</span>
      {busy && <span role="status">Saving</span>}
      {!busy && notice && (
        <span role={notice.error ? "alert" : "status"} className={notice.error ? styles.fieldError : ""}>
          {notice.text}
        </span>
      )}
    </div>
  );
}
