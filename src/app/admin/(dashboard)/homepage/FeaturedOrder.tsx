"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "../../admin.module.css";
import { OrderBar } from "../OrderBar";
import { SortableList } from "../SortableList";
import { publishFeaturedOrder } from "./actions";

export interface FeaturedRow {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  pending: boolean;
}

/** How many featured products the homepage's grid shows. */
const SHOWN = 12;

export function FeaturedOrder({ products }: { products: FeaturedRow[] }) {
  const [order, setOrder] = useState(products);
  const [live, setLive] = useState(products);

  if (products.length === 0) {
    return <p className={styles.muted}>No products are featured. Tick Featured in a product&apos;s editor and publish it.</p>;
  }

  return (
    <>
      <OrderBar
        changed={order.some((p, i) => p.id !== live[i]?.id)}
        onPublish={async () => {
          const result = await publishFeaturedOrder({ ids: order.map((p) => p.id) });
          if (result.ok) setLive(order);
          return result;
        }}
        onUndo={() => setOrder(live)}
      />
      <SortableList
        items={order}
        getId={(p) => p.id}
        getLabel={(p) => `${p.sku} ${p.name}`}
        label="Featured products in homepage order"
        onChange={setOrder}
        render={(p, index) => (
          <span className={styles.orderRow}>
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt="" width={40} height={40} className={styles.orderThumb} />
            ) : (
              <span className={styles.orderThumb} aria-hidden="true" />
            )}
            <Link href={`/admin/products/${p.id}`}>{p.sku}</Link>
            <span>{p.name}</span>
            {index >= SHOWN && <span className={styles.muted}>not shown: the homepage shows the first {SHOWN}</span>}
            {p.pending && <span className={`${styles.badge} ${styles.badgeWarn}`}>Publish the product to feature it</span>}
          </span>
        )}
      />
    </>
  );
}
