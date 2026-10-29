/**
 * The columns each entity can be imported from or exported to.
 *
 * One list per entity, shared by export (its headers), the mapping screen
 * (what a sheet's headers can be matched to) and staging (how each value is
 * read). Exports use the labels as headers, so an exported sheet maps itself
 * when it is imported back.
 */

export type Entity = "products" | "categories" | "finishes" | "product_finishes";

export interface FieldDef {
  key: string;
  label: string;
  /** Other headers that mean the same, compared loosely. */
  aliases: string[];
  /** Shown on the mapping screen. */
  help?: string;
  /** Required to create a new row. */
  requiredForNew?: boolean;
  /** Blank can never mean "clear" for these. */
  required?: boolean;
}

export const ENTITY_LABEL: Record<Entity, string> = {
  products: "Products",
  categories: "Categories",
  finishes: "Finishes",
  product_finishes: "Product finishes",
};

/** A list inside one cell: separated by " | " or by line breaks. */
export const LIST_SEPARATOR = " | ";

export const FIELDS: Record<Entity, FieldDef[]> = {
  products: [
    { key: "id", label: "ID", aliases: ["internal id", "uuid"], help: "Only needed when item codes themselves are being changed." },
    { key: "sku", label: "Item code", aliases: ["code", "sku", "product code", "item no", "item number", "reference", "ref"], requiredForNew: true, required: true },
    { key: "name", label: "Name", aliases: ["product name", "title", "product"], requiredForNew: true, required: true },
    { key: "slug", label: "Web address", aliases: ["slug", "url"], help: "Made from the item code when left out.", required: true },
    { key: "category", label: "Category", aliases: ["category name", "range"], help: "A category's name or web address.", requiredForNew: true, required: true },
    { key: "type", label: "Type", aliases: ["product type", "kind"], help: "A type's name within the product's category." },
    { key: "description", label: "Description", aliases: ["details", "text"] },
    { key: "dimensions", label: "Dimensions", aliases: ["size", "sizes", "measurements"] },
    { key: "features", label: "Features", aliases: ["feature list"], help: "Separated by | or one per line." },
    { key: "finishes", label: "Finishes", aliases: ["colours", "colors", "finish"], help: "Web addresses or codes, separated by | or one per line." },
    { key: "status", label: "Status", aliases: ["state"], help: "Visible or Hidden. New products always start hidden." },
    { key: "featured", label: "Featured", aliases: ["homepage"], help: "Yes or No." },
  ],
  categories: [
    { key: "id", label: "ID", aliases: ["internal id", "uuid"] },
    { key: "slug", label: "Web address", aliases: ["slug", "url"], help: "Made from the name when left out.", required: true },
    { key: "name", label: "Name", aliases: ["category", "title"], requiredForNew: true, required: true },
    { key: "blurb", label: "Description", aliases: ["blurb", "text"], help: "Paragraphs separated by a blank line." },
    { key: "status", label: "Status", aliases: ["state"], help: "Visible or Hidden. New categories always start hidden." },
  ],
  finishes: [
    { key: "id", label: "ID", aliases: ["internal id", "uuid"] },
    { key: "slug", label: "Web address", aliases: ["slug", "url"], help: "Made from the code and name when left out.", required: true },
    { key: "code", label: "Code", aliases: ["finish code", "colour code", "color code"], requiredForNew: true, required: true },
    { key: "name", label: "Name", aliases: ["finish", "colour", "color", "finish name"], requiredForNew: true, required: true },
    { key: "family", label: "Material", aliases: ["family", "material type"], requiredForNew: true, required: true },
    { key: "status", label: "Status", aliases: ["state"], help: "Active or Retired." },
  ],
  product_finishes: [
    { key: "sku", label: "Item code", aliases: ["code", "sku", "product code", "item no", "item number"], required: true },
    { key: "finish", label: "Finish", aliases: ["finish code", "colour", "color", "finish web address"], help: "A finish's web address or code.", required: true },
  ],
};

/** What can identify an existing row, per entity; the first is the default. */
export const IDENTITIES: Record<Entity, Array<{ key: string; label: string }>> = {
  products: [
    { key: "sku", label: "Item code" },
    { key: "id", label: "ID (when item codes are being changed)" },
  ],
  categories: [
    { key: "slug", label: "Web address" },
    { key: "id", label: "ID" },
  ],
  finishes: [
    { key: "slug", label: "Web address" },
    { key: "id", label: "ID" },
  ],
  product_finishes: [{ key: "sku", label: "Item code" }],
};

export interface ImportOptions {
  identity: string;
  /** "keep": a blank cell leaves the field as it is. "clear": it empties it. */
  blanks: "keep" | "clear";
  /** Rows that match nothing: create them, or leave them out. */
  unknown: "create" | "skip";
}

export const DEFAULT_OPTIONS = (entity: Entity): ImportOptions => ({
  identity: IDENTITIES[entity][0]!.key,
  blanks: "keep",
  unknown: entity === "product_finishes" ? "skip" : "create",
});

/** Header → field key, for every header whose name matches a field's label
 *  or one of its aliases. */
export function suggestMapping(entity: Entity, headers: string[], normalise: (h: string) => string): Record<string, string> {
  const byName = new Map<string, string>();
  for (const f of FIELDS[entity]) {
    for (const name of [f.label, f.key, ...f.aliases]) byName.set(normalise(name), f.key);
  }
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  headers.forEach((header, index) => {
    const key = byName.get(normalise(header));
    if (key && !used.has(key)) {
      mapping[String(index)] = key;
      used.add(key);
    }
  });
  return mapping;
}
