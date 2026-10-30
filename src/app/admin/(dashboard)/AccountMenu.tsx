"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useRef, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon/Icon";
import { THEME_LABELS, THEMES } from "@/lib/theme";
import { applyTheme, getServerSnapshot, getSnapshot, subscribe } from "@/lib/theme-store";
import { signOut } from "../sign-in/actions";
import styles from "../admin.module.css";

/**
 * Who is signed in, and the things only that person does: switch palette and
 * sign out. They used to sit in the bar as four loose items (the address, an
 * icon, two underlined links), louder than the sections themselves. One
 * button holding the initial keeps the bar to navigation.
 *
 * Built on Radix's DropdownMenu, so arrow keys, Escape and focus return work
 * the way a menu should. On a phone View site moves in here too, which keeps
 * the bar to a single row.
 */
export function AccountMenu({ email }: { email: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? THEMES[0];
  const initial = email.trim().charAt(0).toUpperCase() || "?";
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      {/* Outside the menu, so it is still mounted when the item is chosen.
          The item used to be a submit button pointing here by id, but
          choosing it closes the menu, and the button left the page before
          the browser got to submit: nothing happened. Submitting this form
          from onSelect doesn't depend on the item outliving the click. */}
      <form ref={signOutForm} action={signOut} hidden />
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger className={styles.account} aria-label={`Account: ${email}`} title={email}>
          <span className={styles.avatar} aria-hidden="true">
            {initial}
          </span>
          <Icon name="chevron" size={16} className={styles.chevron} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={12}>
            <div className={styles.menuWho}>
              <span className={styles.menuWhoLabel}>Signed in as</span>
              <span className={styles.menuEmail}>{email}</span>
            </div>
            <DropdownMenu.Separator className={styles.menuRule} />
            <DropdownMenu.Item asChild className={`${styles.menuItem} ${styles.menuPhoneOnly}`}>
              <Link href="/">
                <Icon name="externalLink" />
                View site
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={styles.menuItem} onSelect={() => applyTheme(next)}>
              <Icon name="contrast" />
              Switch to the {THEME_LABELS[next]} palette
            </DropdownMenu.Item>
            <DropdownMenu.Separator className={styles.menuRule} />
            <DropdownMenu.Item className={styles.menuItem} onSelect={() => signOutForm.current?.requestSubmit()}>
              <Icon name="logOut" />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
