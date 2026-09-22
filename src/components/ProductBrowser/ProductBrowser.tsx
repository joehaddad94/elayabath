"use client";

import Image from "next/image";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ProductGrid } from "@/components/ProductGrid/ProductGrid";
import { format, type Dictionary } from "@/lib/i18n";
import {
  getSearch,
  getServerSearch,
  setSearch,
  subscribeToSearch,
} from "@/lib/url-filters";
import type { Locale } from "@/lib/i18n/config";
import type { Category, FacetOption, Finish, FinishFamily, Product } from "@/lib/types";
import styles from "./ProductBrowser.module.css";

interface Selection {
  type: string[];
  material: string[];
  colour: string[];
}

function readSelection(search: string): Selection {
  const params = new URLSearchParams(search);
  const get = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];
  return {
    type: get("type"),
    material: get("material"),
    colour: get("colour"),
  };
}

function toParams(selection: Selection): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(selection)) {
    if (values.length > 0) params.set(key, values.join(","));
  }
  return params;
}

export function ProductBrowser({
  category,
  products,
  finishes,
  locale,
  t,
}: {
  category: Category;
  products: Product[];
  finishes: Finish[];
  locale: Locale;
  t: Dictionary;
}) {
  // The URL is the state. A link to a filtered shelf therefore arrives
  // filtered with no effect needed, and the browser's back button works.
  const search = useSyncExternalStore(
    subscribeToSearch,
    getSearch,
    getServerSearch,
  );
  const selection = useMemo(() => readSelection(search), [search]);

  const toggle = useCallback(
    (axis: keyof Selection, value: string) => {
      const values = selection[axis];
      const next: Selection = {
        ...selection,
        [axis]: values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value],
      };
      setSearch(toParams(next));
    },
    [selection],
  );

  const clear = useCallback(() => setSearch(new URLSearchParams()), []);

  const visible = useMemo(
    () =>
      products.filter((product) => {
        if (selection.type.length && !selection.type.includes(product.type.slug)) {
          return false;
        }
        if (
          selection.material.length &&
          !product.materials.some((m) => selection.material.includes(m))
        ) {
          return false;
        }
        if (
          selection.colour.length &&
          !product.finishes.some((f) => selection.colour.includes(f))
        ) {
          return false;
        }
        return true;
      }),
    [products, selection],
  );

  const colourGroups = useMemo(() => {
    const groups = new Map<string, { name: string; finishes: Finish[] }>();
    for (const finish of finishes) {
      const group = groups.get(finish.family) ?? {
        name: finish.familyName,
        finishes: [],
      };
      group.finishes.push(finish);
      groups.set(finish.family, group);
    }
    return [...groups.entries()].sort(
      (a, b) => b[1].finishes.length - a[1].finishes.length,
    );
  }, [finishes]);

  const active =
    selection.type.length + selection.material.length + selection.colour.length;

  return (
    <div className={styles.shelf}>
      <form className={styles.facets} aria-labelledby="facets-heading">
        <h2 className="sr-only" id="facets-heading">
          {t.category.filters}
        </h2>
        <Facet
          title={t.common.productType}
          name="type"
          options={category.productTypes}
          selected={selection.type}
          onToggle={toggle}
        />

        <Facet
          title={t.common.material}
          name="material"
          options={category.materials as FacetOption<FinishFamily>[]}
          selected={selection.material}
          onToggle={toggle}
        />

        <div className={styles.facet}>
          <h3>
            {t.common.colour}{" "}
            <span className={styles.groupCount}>{finishes.length}</span>
          </h3>
          {colourGroups.map(([family, group], index) => (
            <details key={family} className={styles.group} open={index === 0}>
              <summary>
                {group.name}
                <span className={styles.groupCount}>{group.finishes.length}</span>
              </summary>
              <div className={styles.swatches}>
                {group.finishes.map((finish) => (
                  <label
                    key={finish.slug}
                    className={styles.swatch}
                    title={`${finish.code} ${finish.name}`}
                  >
                    <input
                      type="checkbox"
                      name="colour"
                      value={finish.slug}
                      checked={selection.colour.includes(finish.slug)}
                      onChange={() => toggle("colour", finish.slug)}
                    />
                    {finish.image ? (
                      <Image
                        src={finish.image}
                        alt=""
                        width={96}
                        height={96}
                        sizes="5rem"
                      />
                    ) : (
                      <span className={styles.swatchMissing} aria-hidden="true">
                        {t.category.noSwatch}
                      </span>
                    )}
                    <span className={styles.swatchName}>{finish.name}</span>
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={clear}
            disabled={active === 0}
          >
            {t.category.clearAll}
          </button>
        </div>
      </form>

      <div>
        <h2 className="sr-only">{t.common.products}</h2>
        <div className={styles.toolbar}>
          <p className={styles.count} role="status">
            {format(t.category.showing, {
              shown: visible.length,
              total: products.length,
            })}
          </p>
        </div>

        {visible.length > 0 ? (
          <ProductGrid products={visible} locale={locale} t={t} priorityCount={4} />
        ) : (
          <p className={styles.empty}>{t.category.noResults}</p>
        )}
      </div>
    </div>
  );
}

function Facet({
  title,
  name,
  options,
  selected,
  onToggle,
}: {
  title: string;
  name: keyof Selection;
  options: FacetOption[];
  selected: string[];
  onToggle: (axis: keyof Selection, value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className={styles.facet}>
      <h3>{title}</h3>
      <ul>
        {options.map((option) => (
          <li key={option.value}>
            <label className={styles.opt}>
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={() => onToggle(name, option.value)}
              />
              <span className={styles.optLabel}>{option.label}</span>
              <span className={styles.optCount}>{option.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
