"use client";

import { useActionState } from "react";
import styles from "../../admin.module.css";
import { createCategory, type NewCategoryState } from "./actions";

export function NewCategoryForm() {
  const [state, action, pending] = useActionState<NewCategoryState, FormData>(createCategory, {});
  return (
    <form action={action} key={state.attempt ?? 0}>
      <div className={styles.inline}>
        <div className={styles.field}>
          <label htmlFor="new-category-name">Name</label>
          <input id="new-category-name" name="name" className="input" required defaultValue={state.values?.name} autoComplete="off" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating" : "Create category, hidden"}
        </button>
      </div>
      <p className={styles.muted}>It stays hidden until you make it visible, and only appears in the menu once it has visible products.</p>
      {state.error && (
        <p className={`${styles.message} ${styles.messageError}`} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
