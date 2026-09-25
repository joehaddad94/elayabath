import { z } from "zod";
import { FINISH_FAMILY_NAMES, type FinishFamily } from "@/lib/types";

/**
 * What categories and finishes may hold, for the dashboard's forms and the
 * Server Actions behind them (and later import). Shared by server and browser,
 * like product-schema.ts.
 */

const slug = z
  .string()
  .trim()
  .min(1, "A web address is required.")
  .max(80, "A web address can be at most 80 characters.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters and digits, with single dashes between words.");

/** An address from a name: "Wall Hung Basins" becomes "wall-hung-basins". */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const productTypeEntry = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "A type needs a name.").max(80, "A type name can be at most 80 characters."),
  slug: slug.optional(),
});

export const categoryForm = z.object({
  name: z.string().trim().min(1, "A name is required.").max(80, "A name can be at most 80 characters."),
  slug,
  blurb: z
    .array(z.string().trim().max(1200, "Each paragraph can be at most 1,200 characters."))
    .max(8, "At most 8 paragraphs.")
    .transform((list) => list.filter((p) => p !== "")),
  status: z.enum(["draft", "active", "discontinued"]),
  types: z
    .array(productTypeEntry)
    .max(60, "At most 60 types.")
    .refine((list) => new Set(list.map((t) => t.name.trim().toLowerCase())).size === list.length, "Two types have the same name."),
});

export type CategoryForm = z.input<typeof categoryForm>;

export const FINISH_FAMILIES = Object.keys(FINISH_FAMILY_NAMES) as [FinishFamily, ...FinishFamily[]];

export const finishForm = z.object({
  name: z.string().trim().min(1, "A name is required.").max(80, "A name can be at most 80 characters."),
  code: z
    .string()
    .trim()
    .min(1, "A code is required.")
    .max(20, "A code can be at most 20 characters.")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits and dashes."),
  slug,
  family: z.enum(FINISH_FAMILIES),
  swatch_path: z
    .string()
    .regex(/^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_./-]*$/, "That swatch isn't a stored file.")
    .nullable(),
  status: z.enum(["active", "retired"]),
});

export type FinishForm = z.input<typeof finishForm>;

/** Blurb paragraphs are edited as one text, separated by blank lines. */
export const blurbFromText = (text: string) => text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim());
export const blurbToText = (blurb: string[]) => blurb.join("\n\n");
