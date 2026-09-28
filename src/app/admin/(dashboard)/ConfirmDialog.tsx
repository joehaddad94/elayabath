"use client";

import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../admin.module.css";

/**
 * The dashboard's own confirmation dialog, in place of the browser's
 * `confirm()`: styled like the rest of the dashboard, focus kept inside it,
 * Cancel focused first, Escape to cancel. Built on Radix's AlertDialog.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete ACE?", body: "…", confirmLabel: "Delete", danger: true }))) return;
 */
export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a warning, for anything that can't be undone. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** For code outside React (the unsaved-changes guard's document listener):
 *  the mounted provider registers itself here. */
let outside: { confirm: Confirm; navigate: (href: string) => void } | null = null;
export const confirmOutsideReact = (options: ConfirmOptions) => outside?.confirm(options) ?? Promise.resolve(true);
export const navigateOutsideReact = (href: string) => (outside ? outside.navigate(href) : window.location.assign(href));

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm needs the ConfirmProvider, which the dashboard layout mounts.");
  return confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    // A second question while one is open answers the first with "no".
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  useEffect(() => {
    outside = { confirm, navigate: (href) => router.push(href) };
    return () => {
      outside = null;
    };
  }, [confirm, router]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={options !== null} onOpenChange={(open) => !open && answer(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.dialogOverlay} />
          <AlertDialog.Content className={styles.dialog}>
            <AlertDialog.Title className={styles.dialogTitle}>{options?.title}</AlertDialog.Title>
            {options?.body ? (
              <AlertDialog.Description className={styles.dialogBody}>{options.body}</AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{options?.title}</AlertDialog.Description>
            )}
            <div className={styles.dialogActions}>
              <AlertDialog.Cancel className="btn btn-secondary" onClick={() => answer(false)}>
                {options?.cancelLabel ?? "Cancel"}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={`btn btn-primary ${options?.danger ? styles.dialogDanger : ""}`}
                onClick={() => answer(true)}
              >
                {options?.confirmLabel ?? "Continue"}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}
