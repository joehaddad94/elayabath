"use client";

import { useActionState } from "react";
import styles from "../../admin.module.css";
import { removeUnusedMedia, type CleanupState } from "./actions";

export function CleanupButton({ count }: { count: number }) {
  const [state, action, pending] = useActionState<CleanupState>(removeUnusedMedia, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${count} unused file${count === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
      }}
    >
      {count > 0 && (
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          {pending ? "Removing" : "Remove unused files"}
        </button>
      )}
      {(state.ok ?? state.error) && (
        <p className={`${styles.message} ${state.error ? styles.messageError : ""}`} role={state.error ? "alert" : "status"}>
          {state.ok ?? state.error}
        </p>
      )}
    </form>
  );
}
