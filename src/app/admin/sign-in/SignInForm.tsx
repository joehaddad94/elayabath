"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import styles from "../admin.module.css";
import { signIn, type SignInState } from "./actions";

const REASONS: Record<string, string> = {
  removed: "Your access to the dashboard has been removed. Ask a colleague if that's a mistake.",
  link: "That sign-in link has expired or was already used. Ask for a new one.",
};

export function SignInForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  const reason = REASONS[params.get("reason") ?? ""];

  if (state.sent) {
    return (
      <p className={styles.message} role="status">
        A sign-in link is on its way to <b>{state.sent}</b>. It works once, for a short while.
      </p>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={params.get("next") ?? "/admin"} />
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        className="input"
        autoComplete="email"
        required
        autoFocus
      />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
      {(state.error ?? reason) && (
        <p className={`${styles.message} ${styles.messageError}`} role="alert">
          {state.error ?? reason}
        </p>
      )}
    </form>
  );
}
