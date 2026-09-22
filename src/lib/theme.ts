/* Theme is one attribute on <html>. No context, no provider, no re-render:
   both palettes are plain CSS keyed off [data-theme], so switching is a
   single DOM write and the browser repaints. */

export const THEMES = ["ink", "stone"] as const;

export type Theme = (typeof THEMES)[number];

/** Ink first: the recovered photography is warm golden-hour work, and the
 *  charcoal ground flatters it in a way the limestone one does not. */
export const DEFAULT_THEME: Theme = "ink";

export const THEME_STORAGE_KEY = "elaya-theme";

export const THEME_LABELS: Record<Theme, string> = {
  ink: "Ink",
  stone: "Stone",
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Runs in <head> before first paint, so a visitor who chose Stone never sees
 * Ink flash first. The server renders DEFAULT_THEME; this only corrects it.
 *
 * Deliberately tiny and dependency-free: it is inlined into the document, so
 * every byte is render-blocking. Wrapped in try/catch because localStorage
 * throws outright in a private window with site data blocked.
 */
export const themeInitScript = `
(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t===${JSON.stringify("stone")}||t===${JSON.stringify("ink")}){document.documentElement.dataset.theme=t}
}catch(e){}})();
`.trim();
