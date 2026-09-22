"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { groupFinishesByFamily } from "@/lib/finishes";
import { format, type Dictionary } from "@/lib/i18n";
import type { Finish } from "@/lib/types";
import styles from "./FinishPicker.module.css";

/**
 * The live site shows no way to choose a finish on any of its 596 products,
 * even though the catalogue data carries 3,729 variations across two axes.
 * A buyer can see that a basin exists but not that it comes in sixteen
 * colours.
 *
 * Grouped by material, the same way the category filter groups them, because
 * that is the structure the client's own colour codes already encode.
 */
export function FinishPicker({
  finishes,
  t,
}: {
  finishes: Finish[];
  t: Dictionary;
}) {
  const [selected, setSelected] = useState<string | undefined>(
    finishes[0]?.slug,
  );

  const groups = useMemo(() => groupFinishesByFamily(finishes), [finishes]);

  if (finishes.length === 0) {
    return (
      <div className={styles.picker}>
        <h2>{t.common.finishes}</h2>
        <p className={styles.none}>{t.product.noFinishes}</p>
      </div>
    );
  }

  const current = finishes.find((f) => f.slug === selected) ?? finishes[0];

  return (
    <div className={styles.picker}>
      <h2>{format(t.product.finishCount, { n: finishes.length })}</h2>
      {current && (
        <p className={styles.chosen}>
          {t.product.selected}:{" "}
          <b>
            {current.code} {current.name}
          </b>
        </p>
      )}

      {groups.map((group, index) => (
        <details key={group.family} className={styles.group} open={index === 0}>
          <summary>
            {group.familyName}
            <span className={styles.count}>{group.finishes.length}</span>
          </summary>
          <div className={styles.swatches}>
            {group.finishes.map((finish) => (
              <button
                key={finish.slug}
                type="button"
                className={styles.swatch}
                aria-pressed={finish.slug === current?.slug}
                title={`${finish.code} ${finish.name}`}
                onClick={() => setSelected(finish.slug)}
              >
                {finish.image ? (
                  <Image
                    src={finish.image}
                    alt=""
                    width={96}
                    height={96}
                    sizes="5rem"
                  />
                ) : (
                  <span className={styles.missing} aria-hidden="true">
                    {t.category.noSwatch}
                  </span>
                )}
                <span className={styles.name}>{finish.name}</span>
              </button>
            ))}
          </div>
        </details>
      ))}

      <p className={styles.note}>{t.category.swatchNote}</p>
    </div>
  );
}
