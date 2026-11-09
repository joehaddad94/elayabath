import { redirect } from "next/navigation";

/** Site content opens on the homepage, the page edited most. */
export default function SiteContentIndex() {
  redirect("/admin/site/home");
}
