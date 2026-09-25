"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../../admin.module.css";
import { SortableList } from "../SortableList";
import { OrderBar } from "../OrderBar";
import { publishCategoryOrder } from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  status: "Draft" | "Live" | "Hidden";
  changes: boolean;
  products: number;
  live: number;
}

export function CategoryOrder({ categories }: { categories: CategoryRow[] }) {
  const [order, setOrder] = useState(categories);
  const [saved, setSaved] = useState(categories);
  const changed = order.some((c, i) => c.id !== saved[i]?.id);

  return (
    <>
      <OrderBar
        changed={changed}
        onPublish={async () => {
          const result = await publishCategoryOrder({ ids: order.map((c) => c.id) });
          if (result.ok) setSaved(order);
          return result;
        }}
        onUndo={() => setOrder(saved)}
      />
      <SortableList
        items={order}
        getId={(c) => c.id}
        getLabel={(c) => c.name}
        label="Categories in menu order"
        onChange={setOrder}
        render={(c) => (
          <span className={styles.orderRow}>
            <Link href={`/admin/categories/${c.id}`}>{c.name}</Link>
            <span className={`${styles.badge} ${c.status === "Live" ? "" : styles.badgeWarn}`}>{c.status}</span>
            {c.changes && <span className={`${styles.badge} ${styles.badgeWarn}`}>Unpublished changes</span>}
            <span className={styles.muted}>
              {c.live} live of {c.products} product{c.products === 1 ? "" : "s"}
            </span>
          </span>
        )}
      />
    </>
  );
}
