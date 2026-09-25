import { z } from "zod";

/**
 * What a product's fields may hold. One schema for every way a product is
 * written (the editor, an inline edit in the grid, and later an import), so
 * a value the editor refuses cannot arrive by another route.
 *
 * Shared by server and browser: the editor checks as you type with the same
 * rules the Server Action enforces.
 */

/** A path inside a bucket: no leading slash, no "..", ordinary characters. */
const STORAGE_PATH = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_./-]*$/;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const productFields = {
  sku: z
    .string()
    .trim()
    .min(1, "An item code is required.")
    .max(60, "An item code can be at most 60 characters.")
    // Codes like "E06-SW10353 A+ E06-SW10353 B" name a pair sold together.
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ._/+()#&-]*$/, "Use letters, digits, spaces and . _ / + ( ) # & -"),
  slug: z
    .string()
    .trim()
    .min(1, "A web address is required.")
    .max(120, "A web address can be at most 120 characters.")
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use lower-case letters, digits, dashes and underscores."),
  name: z.string().trim().min(1, "A name is required.").max(200, "A name can be at most 200 characters."),
  category_id: z.uuid("Choose a category."),
  type_id: z.uuid().nullable(),
  description: z.string().trim().max(5000, "The description can be at most 5,000 characters."),
  dimensions: optionalText(200, "Dimensions"),
  features: z
    .array(z.string().trim().max(300, "Each feature can be at most 300 characters."))
    .max(40, "At most 40 features.")
    .transform((list) => list.filter((f) => f !== "")),
  datasheet_path: z
    .string()
    .regex(STORAGE_PATH, "That data sheet isn't a stored file.")
    .refine((p) => p.endsWith(".pdf"), "A data sheet must be a PDF.")
    .nullable(),
  status: z.enum(["draft", "active", "discontinued"]),
  featured: z.boolean(),
};

/** One photograph in the gallery. The file is already in Storage; this is
 *  what the product says about it. */
export const productImage = z.object({
  path: z.string().regex(STORAGE_PATH, "That photograph isn't a stored file."),
  alt: z.string().trim().max(300, "Alt text can be at most 300 characters."),
  caption: z.string().trim().max(300, "A caption can be at most 300 characters.").nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
});

export type ProductImage = z.input<typeof productImage>;

export const productForm = z.object({
  ...productFields,
  images: z.array(productImage).max(40, "At most 40 photographs.").refine(
    (list) => new Set(list.map((i) => i.path)).size === list.length,
    "A photograph is listed twice.",
  ),
  finishes: z
    .array(z.uuid())
    .max(300)
    .refine((ids) => new Set(ids).size === ids.length, "A finish is listed twice."),
});

export type ProductForm = z.input<typeof productForm>;

/** The same web address the seed gives a product: its item code, lower case,
 *  with anything outside letters, digits and dashes turned into underscores. */
export function slugFromSku(sku: string): string {
  return sku
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/** Maps a database error from a product write to something an editor can act
 *  on. Unique clashes are the common one: item codes and addresses are unique. */
export function describeWriteError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("sku")) return "Another product already has this item code.";
    if (error.message.includes("slug")) return "Another product already uses this web address.";
    return "That clashes with another product.";
  }
  if (error.code === "23503") return "The category or type chosen no longer exists. Reload and choose again.";
  return "That couldn't be saved. Try again.";
}
