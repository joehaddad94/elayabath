import en, { type Dictionary } from "./dictionaries/en";
import { DEFAULT_LOCALE, type Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { en };

/**
 * Synchronous because there is one locale and it is bundled. When a second
 * arrives this becomes a dynamic import and every caller is already awaiting
 * a server component, so the signature change is contained.
 */
export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? en;
}

export type { Dictionary };
export * from "./config";
