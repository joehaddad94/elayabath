"use client";

import Image from "next/image";
import { useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon/Icon";
import { storageUrl } from "@/lib/supabase/config";
import { Spinner } from "../../Spinner";
import { uploadProductPhoto } from "./Media";
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
 *
 * Each chosen finish can carry a photograph of the product in that finish,
 * which the site shows when a buyer picks it. Without one the site shows the
 * main photo, so adding them is never required.
 */
export function FinishPicker({
  productId,
  library,
  value,
  photos,
  onChange,
}: {
  productId: string;
  library: FinishOption[];
  value: string[];
  /** Finish id to its photo's storage path. */
  photos: Record<string, string>;
  onChange: (next: string[], photos: Record<string, string>) => void;
}) {
  const [query, setQuery] = useState("");
  // The library stays closed until someone searches or asks for it, so a
  // product with its finishes chosen doesn't carry 40 more below them.
  const [browsing, setBrowsing] = useState(false);
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
    onChange(next, photos);
  };

  const without = (id: string) => Object.fromEntries(Object.entries(photos).filter(([k]) => k !== id));

  const setPhoto = (id: string, path: string | null) =>
    onChange(value, path ? { ...without(id), [id]: path } : without(id));

  const remove = (id: string) => onChange(value.filter((v) => v !== id), without(id));

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
                <FinishPhoto
                  productId={productId}
                  name={f?.name ?? "this finish"}
                  path={photos[id] ?? null}
                  onChange={(path) => setPhoto(id, path)}
                />
                <span className={styles.rowButtons}>
                  <button type="button" className="btn btn-icon btn-secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${f?.name ?? "finish"} up`}>
                    <Icon name="arrowUp" />
                  </button>
                  <button type="button" className="btn btn-icon btn-secondary" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${f?.name ?? "finish"} down`}>
                    <Icon name="arrowDown" />
                  </button>
                  <button type="button" className="btn btn-icon btn-secondary" onClick={() => remove(id)} aria-label={`Remove ${f?.name ?? "finish"}`}>
                    <Icon name="close" />
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
        {!browsing && query.trim() === "" ? (
          <button type="button" className={`btn btn-secondary ${styles.browse}`} onClick={() => setBrowsing(true)}>
            Browse the library
          </button>
        ) : (
        <ul className={styles.options} aria-label="Finishes you can add">
          {matches.map((f) => (
            <li key={f.id}>
              <button type="button" className={styles.option} onClick={() => onChange([...value, f.id], photos)}>
                <Swatch finish={f} />
                <span className={styles.finishName}>
                  {f.name}
                  <span className={styles.finishCode}>
                    {f.code} · {f.family}
                    {f.sharedCode && <span className={styles.flag}> · code shared</span>}
                  </span>
                </span>
                <Icon name="plus" />
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className={styles.hint}>Nothing matches.</li>}
        </ul>
        )}
      </div>
    </div>
  );
}

/** One finish's photo: a thumbnail with Remove, or an Add photo button. */
function FinishPhoto({
  productId,
  name,
  path,
  onChange,
}: {
  productId: string;
  name: string;
  path: string | null;
  onChange: (path: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      onChange((await uploadProductPhoto(productId, file)).path);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : `${file.name} couldn't be uploaded.`);
    }
    setBusy(false);
  };

  return (
    <span className={styles.finishPhoto}>
      {path ? (
        <>
          <Image src={storageUrl("product-media", path)} alt="" width={44} height={44} className={styles.finishThumb} />
          <button type="button" className="btn btn-secondary" onClick={() => onChange(null)} aria-label={`Remove the ${name} photo`}>
            Remove photo
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()} aria-label={`Add a photo in ${name}`}>
          {busy ? <><Spinner />Uploading</> : "Add photo"}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        aria-label={`Photo in ${name}`}
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {problem && (
        <span className={styles.problems} role="alert">
          {problem}
        </span>
      )}
    </span>
  );
}

function Swatch({ finish }: { finish: FinishOption | undefined }) {
  return finish?.swatchUrl ? (
    <Image src={finish.swatchUrl} alt="" width={28} height={28} className={styles.swatch} />
  ) : (
    // No swatch in the client's data. The code beside the name says which
    // finish it is, so the tile only has to say "no swatch".
    <span className={`${styles.swatch} ${styles.noSwatch}`} aria-hidden="true">
      <Icon name="ban" size={16} />
    </span>
  );
}
