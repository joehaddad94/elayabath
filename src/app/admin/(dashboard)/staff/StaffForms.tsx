"use client";

import { useActionState } from "react";
import styles from "../../admin.module.css";
import { addStaff, removeStaff, type StaffState } from "./actions";

export function AddStaffForm() {
  const [state, action, pending] = useActionState<StaffState, FormData>(addStaff, {});
  return (
    <form action={action}>
      <div className={styles.inline}>
        <div className={styles.field}>
          <label htmlFor="new-staff">Add someone</label>
          <input id="new-staff" name="email" type="email" className="input" required placeholder="name@company.com" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Adding" : "Add to staff"}
        </button>
      </div>
      {(state.ok ?? state.error) && (
        <p className={`${styles.message} ${state.error ? styles.messageError : ""}`} role={state.error ? "alert" : "status"}>
          {state.ok ?? state.error}
        </p>
      )}
    </form>
  );
}

export function RemoveStaffButton({ email }: { email: string }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(removeStaff, {});
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        className={styles.linkButton}
        disabled={pending}
        aria-label={`Remove ${email}`}
      >
        {pending ? "Removing" : "Remove"}
      </button>
      {(state.ok ?? state.error) && (
        <span className={styles.muted} role={state.error ? "alert" : "status"}>
          {" "}
          {state.ok ?? state.error}
        </span>
      )}
    </form>
  );
}
