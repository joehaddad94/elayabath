import { z } from "zod";

/**
 * The products grid's state: its sort and column filters as AG Grid reports
 * them, plus the toolbar's own filters. Shared by the browser, which builds
 * it, and the server, which turns it into a query; the schema is what the
 * server trusts, never the browser's word for it.
 */
const textCondition = z.object({
  filterType: z.literal("text"),
  type: z.enum(["contains", "notContains", "equals", "notEqual", "startsWith", "endsWith", "blank", "notBlank"]),
  filter: z.string().max(200).optional(),
});
const numberCondition = z.object({
  filterType: z.literal("number"),
  type: z.enum(["equals", "notEqual", "lessThan", "lessThanOrEqual", "greaterThan", "greaterThanOrEqual", "inRange", "blank", "notBlank"]),
  filter: z.number().nullish(),
  filterTo: z.number().nullish(),
});
// One condition per column: the grid offers no AND/OR combinations.
export const condition = z.union([textCondition, numberCondition]);

export const gridStateSchema = z.object({
  sort: z
    .array(z.object({ colId: z.string(), sort: z.enum(["asc", "desc"]) }))
    .max(4)
    .default([]),
  filter: z.record(z.string(), condition).default({}),
  // The toolbar's own filters, outside the grid's column menus.
  q: z.string().max(100).default(""),
  category: z.string().max(80).default(""),
  status: z.enum(["", "draft", "active", "discontinued"]).default(""),
  incomplete: z.boolean().default(false),
  changes: z.boolean().default(false),
  importJob: z.string().uuid().or(z.literal("")).default(""),
});
export type GridState = z.infer<typeof gridStateSchema>;
