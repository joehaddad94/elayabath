import Image from "next/image";
import type { Finish } from "@/lib/types";
import styles from "./FinishRail.module.css";

/**
 * Finishes shown as named swatches with their codes. The code is what the
 * client quotes against and what a sample request has to cite, so it is not
 * decoration.
 */
export function FinishRail({
  finishes,
  note,
  missingLabel,
}: {
  finishes: Finish[];
  note?: string;
  missingLabel: string;
}) {
  return (
    <>
      <div className={styles.rail}>
        {finishes.map((finish) => (
          <div key={finish.slug} className={styles.swatch}>
            {finish.image ? (
              <Image
                src={finish.image}
                alt={`${finish.code} ${finish.name}`}
                width={96}
                height={96}
                sizes="6rem"
              />
            ) : (
              <span className={styles.missing} aria-hidden="true">
                {missingLabel}
              </span>
            )}
            <span className={styles.name}>
              <span className={styles.code}>{finish.code}</span>
              {finish.name}
            </span>
          </div>
        ))}
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </>
  );
}
