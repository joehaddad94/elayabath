"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import styles from "../../admin.module.css";
import { useConfirm } from "../ConfirmDialog";
import { Spinner } from "../Spinner";
import { createCollection, groupProducts, type NewCollectionState } from "./actions";

export function NewCollectionForm({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<NewCollectionState, FormData>(createCollection, {});
  return (
    <form action={action} key={state.attempt ?? 0}>
      <div className={styles.inline}>
        <div className={styles.field}>
          <label htmlFor="new-collection-name">Name</label>
          <input id="new-collection-name" name="name" className="input" required defaultValue={state.values?.name} autoComplete="off" />
        </div>
        <div className={styles.field}>
          <label htmlFor="new-collection-category">Category</label>
          <select id="new-collection-category" name="category_id" className="input" required defaultValue={state.values?.category_id ?? ""}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <><Spinner />Creating</> : "Create collection"}
        </button>
      </div>
      <p className={styles.muted}>It appears on the site once you put a visible product in it, from the product&apos;s editor.</p>
      {state.error && (
        <p className={`${styles.message} ${styles.messageError}`} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Puts every product without a collection into one named after it. */
export function GroupProducts({ count }: { count: number }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const n = `${count} product${count === 1 ? "" : "s"}`;

  return (
    <p>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={async () => {
          const go = await confirm({
            title: `Put ${n} in collections by name?`,
            body: "Each goes into the collection with its name in its category, which is made if there isn't one. Visible products then appear on the site.",
            confirmLabel: "Put in collections",
          });
          if (!go) return;
          setBusy(true);
          const outcome = await groupProducts().catch(() => ({ ok: false, message: "That didn't reach the server. Try again." }));
          setBusy(false);
          setResult(outcome);
          router.refresh();
        }}
      >
        {busy && <Spinner />}
        Put {n} in collections by name
      </button>
      {result && (
        <span role={result.ok ? "status" : "alert"}> {result.message}</span>
      )}
    </p>
  );
}
