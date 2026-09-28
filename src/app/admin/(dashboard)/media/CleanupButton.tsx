"use client";

import { startTransition, useActionState } from "react";
import styles from "../../admin.module.css";
import { useConfirm } from "../ConfirmDialog";
import { removeUnusedMedia, type CleanupState } from "./actions";

export function CleanupButton({ count }: { count: number }) {
  const [state, action, pending] = useActionState<CleanupState>(removeUnusedMedia, {});
  const confirm = useConfirm();

  const remove = async () => {
    const go = await confirm({
      title: `Remove ${count} unused file${count === 1 ? "" : "s"}?`,
      body: "Nothing uses them: no product, the live site or any published version. This can't be undone.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (go) startTransition(() => action());
  };

  return (
    <div>
      {count > 0 && (
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => void remove()}>
          {pending ? "Removing" : "Remove unused files"}
        </button>
      )}
      {(state.ok ?? state.error) && (
        <p className={`${styles.message} ${state.error ? styles.messageError : ""}`} role={state.error ? "alert" : "status"}>
          {state.ok ?? state.error}
        </p>
      )}
    </div>
  );
}
