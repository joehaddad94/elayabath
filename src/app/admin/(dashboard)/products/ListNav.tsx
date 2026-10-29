"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/Icon/Icon";
import { rememberList, useListMemory } from "./listMemory";
import s from "./list.module.css";

/**
 * The editor's way back: "Products" returns to the list as it was left (its
 * search and filters, scrolled to this product), and Previous and Next step
 * through that same list. Previous and Next appear only when this product
 * was opened from the list, and each only when there is one to go to.
 */
export function ListNav({ id, sku }: { id: string; sku: string }) {
  const memory = useListMemory();

  // The list scrolls back to the last product opened, however it was reached.
  useEffect(() => rememberList({ lastId: id }), [id]);

  const index = memory?.ids.indexOf(id) ?? -1;
  const prev = index > 0 ? memory!.ids[index - 1] : null;
  const next = index >= 0 && index < memory!.ids.length - 1 ? memory!.ids[index + 1] : null;

  return (
    <nav className={s.listNav} aria-label="Products">
      <p className={s.crumbs}>
        <Link href={memory?.href ?? "/admin/products"}>Products</Link> / {sku}
      </p>
      {index >= 0 && (
        <p className={s.steps}>
          {prev && (
            <Link href={`/admin/products/${prev}`} rel="prev">
              <Icon name="chevronLeft" size={16} />
              Previous
            </Link>
          )}
          <span className={s.position}>
            {index + 1} of {memory!.ids.length}
          </span>
          {next && (
            <Link href={`/admin/products/${next}`} rel="next">
              Next
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
        </p>
      )}
    </nav>
  );
}
