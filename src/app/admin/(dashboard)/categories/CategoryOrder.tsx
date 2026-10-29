"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../../admin.module.css";
import { SortableList } from "../SortableList";
import { OrderBar } from "../OrderBar";
import { saveCategoryOrder } from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  status: "Visible" | "Hidden";
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
        orderKey={order.map((c) => c.id).join()}
        onSave={async () => {
          const saving = order;
          const result = await saveCategoryOrder({ ids: saving.map((c) => c.id) });
          if (result.ok) setSaved(saving);
          return result;
        }}
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
            <span className={`${styles.badge} ${c.status === "Visible" ? "" : styles.badgeWarn}`}>{c.status}</span>
            <span className={styles.muted}>
              {c.live} visible of {c.products} product{c.products === 1 ? "" : "s"}
            </span>
          </span>
        )}
      />
    </>
  );
}
