import { draftMode } from "next/headers";

/** Leaves preview and returns to the product's editor. A POST, from the
 *  preview banner's form, since it changes what later requests see. */
export async function POST(request: Request) {
  (await draftMode()).disable();
  const id = String((await request.formData()).get("product") ?? "");
  const back = /^[0-9a-f-]{36}$/i.test(id) ? `/admin/products/${id}` : "/admin/products";
  return new Response(null, { status: 303, headers: { Location: back } });
}
