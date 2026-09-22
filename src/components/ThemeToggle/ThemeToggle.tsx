"use client";

import { useSyncExternalStore } from "react";
import { THEME_LABELS, THEMES } from "@/lib/theme";
import {
  applyTheme,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/theme-store";
import styles from "./ThemeToggle.module.css";

/**
 * Two buttons, not a switch: there are two named palettes with no on/off
 * relationship between them, and a switch could not say which is which.
 *
 * The palette lives on <html data-theme>, applied by the inline script in the
 * document head before first paint. This component subscribes to that value
 * rather than owning it, so the page renders correctly with JavaScript
 * disabled and never flashes the wrong ground.
 */
export function ThemeToggle({ label }: { label: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className={styles.group} role="group" aria-label={label}>
      {THEMES.map((name) => (
        <button
          key={name}
          type="button"
          className={styles.option}
          aria-pressed={theme === name}
          onClick={() => applyTheme(name)}
        >
          {THEME_LABELS[name]}
        </button>
      ))}
    </div>
  );
}
