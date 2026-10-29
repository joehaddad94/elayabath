"use client";

import { useActionState } from "react";
import styles from "../../../admin.module.css";
import { createProduct, type CreateState } from "../[id]/actions";

export function NewProductForm({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createProduct, {});
  const fieldError = (key: string) =>
    state.fields?.[key] ? (
      <span id={`new-${key}-error`} className={styles.fieldError}>
        {state.fields[key]}
      </span>
    ) : null;
  const described = (key: string) =>
    state.fields?.[key] ? { "aria-invalid": true, "aria-describedby": `new-${key}-error` } : {};

  return (
    // React clears a form after its action runs; a refusal rebuilds it (the
    // key changes) with what was typed as the starting values.
    <form action={action} className={styles.newForm} key={state.attempt ?? 0}>
      <div className={styles.field}>
        <label htmlFor="new-sku">Item code</label>
        <input id="new-sku" name="sku" className="input" required defaultValue={state.values?.sku} autoComplete="off" {...described("sku")} />
        {fieldError("sku")}
      </div>
      <div className={styles.field}>
        <label htmlFor="new-name">Name</label>
        <input id="new-name" name="name" className="input" required defaultValue={state.values?.name} autoComplete="off" {...described("name")} />
        {fieldError("name")}
      </div>
      <div className={styles.field}>
        <label htmlFor="new-category">Category</label>
        <select id="new-category" name="category_id" className="input" required defaultValue={state.values?.category_id ?? ""} {...described("category_id")}>
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {fieldError("category_id")}
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating" : "Create product, hidden"}
        </button>
      </div>
      {state.error && (
        <p className={`${styles.message} ${styles.messageError}`} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
