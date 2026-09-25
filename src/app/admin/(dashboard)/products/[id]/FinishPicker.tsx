"use client";

import Image from "next/image";
import { useId, useMemo, useState } from "react";
import styles from "./editor.module.css";
import type { FinishOption } from "./ProductEditor";

/**
 * The product's finishes, in the order the site shows them, picked from the
 * finish library.
 *
 * The chosen list is ordered with buttons rather than dragging, so it works
 * the same with a keyboard and on a phone. The library is filtered as you
 * type by name or code; a code shared by two finishes (P08 today) is marked
 * wherever it appears, so the right one gets picked.
 */
export function FinishPicker({
  library,
  value,
  onChange,
}: {
  library: FinishOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const byId = useMemo(() => new Map(library.map((f) => [f.id, f])), [library]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(value);
    return library
      .filter((f) => !chosen.has(f.id) && !f.retired)
      .filter((f) => q === "" || f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q) || f.family.toLowerCase().includes(q))
      .slice(0, 40);
  }, [library, query, value]);

  const move = (index: number, by: -1 | 1) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    onChange(next);
  };

  return (
    <div className={styles.finishes}>
      {value.length === 0 ? (
        <p className={styles.hint}>No finishes yet. Add them from the library below.</p>
      ) : (
        <ol className={styles.chosen}>
          {value.map((id, index) => {
            const f = byId.get(id);
            return (
              <li key={id} className={styles.chosenItem}>
                <Swatch finish={f} />
                <span className={styles.finishName}>
                  {f ? f.name : "A finish that no longer exists"}
                  <span className={styles.finishCode}>
                    {f?.code}
                    {f?.sharedCode && <span className={styles.flag}> · code shared with another finish</span>}
                    {f?.retired && <span className={styles.flag}> · retired</span>}
                  </span>
                </span>
                <span className={styles.rowButtons}>
                  <button type="button" className="btn btn-icon btn-secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${f?.name ?? "finish"} up`}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-icon btn-secondary" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${f?.name ?? "finish"} down`}>
                    ↓
                  </button>
                  <button type="button" className="btn btn-icon btn-secondary" onClick={() => onChange(value.filter((v) => v !== id))} aria-label={`Remove ${f?.name ?? "finish"}`}>
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className={styles.library}>
        <label htmlFor={searchId} className={styles.label}>
          Add from the library
        </label>
        <input
          id={searchId}
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, code or material"
          autoComplete="off"
        />
        <ul className={styles.options} aria-label="Finishes you can add">
          {matches.map((f) => (
            <li key={f.id}>
              <button type="button" className={styles.option} onClick={() => onChange([...value, f.id])}>
                <Swatch finish={f} />
                <span className={styles.finishName}>
                  {f.name}
                  <span className={styles.finishCode}>
                    {f.code} · {f.family}
                    {f.sharedCode && <span className={styles.flag}> · code shared</span>}
                  </span>
                </span>
                <span aria-hidden="true">+</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className={styles.hint}>Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}

function Swatch({ finish }: { finish: FinishOption | undefined }) {
  return finish?.swatchUrl ? (
    <Image src={finish.swatchUrl} alt="" width={28} height={28} className={styles.swatch} />
  ) : (
    <span className={styles.swatch} aria-hidden="true" />
  );
}
