/**
 * Fill a dictionary string's {named} placeholders.
 *
 *   format(t.category.showing, { shown: 12, total: 50 })
 *
 * Dictionary values are plain strings so they can cross into client
 * components and, later, live in a JSON file per language. A placeholder with
 * no matching value is left as written rather than silently blanked, so a
 * missing value shows up in review instead of shipping as a gap.
 */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
