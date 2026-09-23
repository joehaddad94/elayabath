"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon/Icon";
import { format } from "@/lib/i18n";
import { THEME_LABELS, THEMES } from "@/lib/theme";
import {
  applyTheme,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/theme-store";
import styles from "./ThemeToggle.module.css";

/**
 * One icon button that advances to the next palette.
 *
 * This was two labelled buttons, INK and STONE, with the active one filled in
 * the accent. That made the palette switch the loudest object in the header,
 * louder than the navigation itself, which is the wrong order of importance
 * for a brand site: almost nobody changes palette, everybody navigates.
 *
 * The cost of a single control is that it cannot show both names at once, so
 * the accessible label names the destination rather than the current state.
 * It advances through THEMES rather than flipping a boolean, so a third
 * palette would still work without this becoming a switch that lies.
 *
 * The palette lives on <html data-theme>, applied by the inline script in the
 * document head before first paint. This subscribes to that value rather than
 * owning it, so the page renders correctly with JavaScript disabled and never
 * flashes the wrong ground.
 */
export function ThemeToggle({ label }: { label: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? THEMES[0];

  return (
    <button
      type="button"
      className={`btn btn-icon ${styles.toggle}`}
      onClick={() => applyTheme(next)}
      aria-label={format(label, { theme: THEME_LABELS[next] })}
      title={format(label, { theme: THEME_LABELS[next] })}
    >
      <Icon name="contrast" />
    </button>
  );
}
