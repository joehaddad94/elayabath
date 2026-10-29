import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { serverClient } from "@/lib/supabase/server";

/**
 * Opens a hidden product's saved copy on the real product page.
 *
 * Staff only: the proxy has already turned away anyone signed out, and this
 * checks the staff list again before switching draft mode on. The address
 * comes from the database, never from the link, so this can't be used to
 * send someone elsewhere.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("product") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Which product?", { status: 400 });

  const supabase = await serverClient();
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) redirect("/admin/sign-in?reason=removed");

  const { data: product } = await supabase.from("products").select("slug").eq("id", id).maybeSingle();
  if (!product) return new Response("No such product.", { status: 404 });

  (await draftMode()).enable();
  redirect(routes.product(product.slug));
}
