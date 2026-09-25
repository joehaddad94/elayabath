"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon/Icon";
import { ProductGrid } from "@/components/ProductGrid/ProductGrid";
import { groupFinishesByFamily } from "@/lib/finishes";
import { format, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import {
  type Axis,
  type Selection,
  type SortKey,
  EMPTY_SELECTION,
  SORT_KEYS,
  appliedFilters,
  countSelected,
  isSortKey,
  shelfQuery,
} from "@/lib/product-filters";
import type { Category, FacetOption, Finish, FinishFamily, ShelfPage } from "@/lib/types";
import {
  getSearch,
  getServerSearch,
  setSearch,
  subscribeToSearch,
} from "@/lib/url-filters";
import styles from "./ProductBrowser.module.css";

function readState(search: string): { selection: Selection; sort: SortKey } {
  const params = new URLSearchParams(search);
  const get = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];
  const sort = params.get("sort");
  return {
    selection: { type: get("type"), material: get("material"), colour: get("colour") },
    sort: isSortKey(sort) ? sort : "default",
  };
}

function toParams(selection: Selection, sort: SortKey): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(selection)) {
    if (values.length > 0) params.set(key, values.join(","));
  }
  if (sort !== "default") params.set("sort", sort);
  return params;
}

/** Products fetched per request. The first page comes with the page itself. */
export const SHELF_PAGE = 24;

/**
 * A category shelf: filters, sort, chips and the grid.
 *
 * The filtering, counting and paging run in the database. The first page of
 * the unfiltered shelf arrives with the page, which is what keeps the page
 * static; every other view of it (a filter, a sort, the next page, or a link
 * shared with filters in it) is fetched from /api/shelf. While a request is
 * in flight the previous results stay on screen, marked busy, rather than
 * flashing empty.
 */
export function ProductBrowser({
  category,
  initial,
  finishes,
  locale,
  t,
}: {
  category: Category;
  initial: ShelfPage;
  finishes: Finish[];
  locale: Locale;
  t: Dictionary;
}) {
  // The URL is the state. A link to a filtered shelf therefore arrives
  // filtered with no effect needed.
  const search = useSyncExternalStore(
    subscribeToSearch,
    getSearch,
    getServerSearch,
  );
  const { selection, sort } = useMemo(() => readState(search), [search]);

  // Collapsed on a phone, where the filter column stood 1184px tall above the
  // grid and pushed the first product 1725px down the page: two full screens
  // of checkboxes before a single basin. Desktop ignores this entirely and
  // shows the column as it always did.
  const [open, setOpen] = useState(false);

  const commit = useCallback(
    (next: Selection, nextSort: SortKey) => setSearch(toParams(next, nextSort)),
    [],
  );

  const toggle = useCallback(
    (axis: Axis, value: string) => {
      const values = selection[axis];
      commit(
        {
          ...selection,
          [axis]: values.includes(value)
            ? values.filter((v) => v !== value)
            : [...values, value],
        },
        sort,
      );
    },
    [selection, sort, commit],
  );

  const clear = useCallback(() => commit(EMPTY_SELECTION, sort), [sort, commit]);

  // What is on screen, with the request it answers. Keyed, so a slow answer
  // to an earlier selection can never be shown against a later one.
  const wanted = shelfQuery(category.slug, selection, sort, 0, SHELF_PAGE);
  const [data, setData] = useState(() => ({
    key: shelfQuery(category.slug, EMPTY_SELECTION, "default", 0, SHELF_PAGE),
    shelf: initial,
  }));
  const [loadingMore, setLoadingMore] = useState(false);
  const busy = data.key !== wanted;

  useEffect(() => {
    if (data.key === wanted) return;
    const controller = new AbortController();
    void fetch(`/api/shelf?${wanted}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<ShelfPage>) : null))
      .then((shelf) => {
        if (shelf) setData({ key: wanted, shelf });
      })
      .catch(() => {
        /* superseded by a newer selection, or offline: keep what is shown */
      });
    return () => controller.abort();
  }, [wanted, data.key]);

  const shown = data.shelf.products;
  const total = data.shelf.total;

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/shelf?${shelfQuery(category.slug, selection, sort, shown.length, SHELF_PAGE)}`,
      );
      if (!response.ok) return;
      const next = (await response.json()) as ShelfPage;
      setData((current) =>
        current.key === wanted
          ? { key: wanted, shelf: { ...next, products: [...current.shelf.products, ...next.products] } }
          : current,
      );
    } finally {
      setLoadingMore(false);
    }
  }, [category.slug, selection, sort, shown.length, wanted]);

  const colourGroups = useMemo(() => groupFinishesByFamily(finishes), [finishes]);

  // Counts that answer "what would I get if I added this", computed by the
  // database against the other axes. Every option the category offers is
  // listed; one the current selection rules out reads zero.
  const typeOptions = useMemo(() => {
    const counts = new Map(data.shelf.facets.type.map((o) => [o.value, o.count]));
    return category.productTypes.map((o) => ({ ...o, count: counts.get(o.value) ?? 0 }));
  }, [data.shelf.facets.type, category.productTypes]);
  const materialOptions = useMemo(() => {
    const counts = new Map(data.shelf.facets.material.map((o) => [o.value, o.count]));
    return category.materials.map((o) => ({ ...o, count: counts.get(o.value) ?? 0 }));
  }, [data.shelf.facets.material, category.materials]);
  const colourCounts = useMemo(
    () => new Map(data.shelf.facets.colour.map((o) => [o.value, o.count])),
    [data.shelf.facets.colour],
  );

  const labels = useMemo(
    () => ({
      type: new Map(category.productTypes.map((o) => [o.value, o.label])),
      material: new Map(category.materials.map((o) => [o.value, o.label])),
      colour: new Map(finishes.map((f) => [f.slug, `${f.code} ${f.name}`])),
    }),
    [category.productTypes, category.materials, finishes],
  );

  const chips = useMemo(() => appliedFilters(selection, labels), [selection, labels]);
  const active = countSelected(selection);

  return (
    <div className={styles.shelf}>
      <button
        type="button"
        className={`btn btn-secondary ${styles.drawerToggle}`}
        aria-expanded={open}
        aria-controls="facets"
        onClick={() => setOpen((o) => !o)}
      >
        {t.category.filters}
        {active > 0 && <span className={styles.drawerCount}>{active}</span>}
      </button>

      <form
        id="facets"
        className={styles.facets}
        data-open={open ? "" : undefined}
        aria-labelledby="facets-heading"
      >
        <h2 className="sr-only" id="facets-heading">
          {t.category.filters}
        </h2>
        <Facet
          title={t.common.productType}
          name="type"
          options={typeOptions}
          selected={selection.type}
          onToggle={toggle}
        />

        <Facet
          title={t.common.material}
          name="material"
          options={materialOptions as FacetOption<FinishFamily>[]}
          selected={selection.material}
          onToggle={toggle}
        />

        <div className={styles.facet}>
          <h3>
            {t.common.colour}{" "}
            <span className={styles.groupCount}>{finishes.length}</span>
          </h3>
          {colourGroups.map((group, index) => (
            <details key={group.family} className={styles.group} open={index === 0}>
              <summary>
                {group.familyName}
                <span className={styles.groupCount}>{group.finishes.length}</span>
              </summary>
              <div className={styles.swatches}>
                {group.finishes.map((finish) => {
                  const count = colourCounts.get(finish.slug) ?? 0;
                  return (
                    <label
                      key={finish.slug}
                      className={styles.swatch}
                      data-empty={count === 0 ? "" : undefined}
                      title={`${finish.code} ${finish.name} — ${count}`}
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
                  );
                })}
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
              shown: shown.length,
              total,
            })}
          </p>

          <label className={styles.sort}>
            <span>{t.category.sortBy}</span>
            <select
              className="input"
              value={sort}
              onChange={(event) =>
                commit(selection, event.target.value as SortKey)
              }
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t.category.sortLabels[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* One chip per applied filter. "Clear all" alone meant removing one
            of three filters sent you back up the column to hunt for its
            checkbox. */}
        {chips.length > 0 && (
          <ul className={styles.chips} aria-label={t.category.applied}>
            {chips.map((chip) => (
              <li key={`${chip.axis}-${chip.value}`}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => toggle(chip.axis, chip.value)}
                >
                  {chip.label}
                  <Icon name="close" size={13} />
                  <span className="sr-only">{t.category.remove}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div aria-busy={busy} className={busy ? styles.busy : undefined}>
          {shown.length > 0 ? (
            <ProductGrid products={shown} locale={locale} t={t} priorityCount={4} />
          ) : (
            <p className={styles.empty}>{t.category.noResults}</p>
          )}
        </div>

        {!busy && shown.length < total && (
          <div className={styles.more}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore
                ? t.category.loading
                : format(t.category.loadMore, { n: Math.min(SHELF_PAGE, total - shown.length) })}
            </button>
          </div>
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
  name: Axis;
  options: FacetOption[];
  selected: string[];
  onToggle: (axis: Axis, value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className={styles.facet}>
      <h3>{title}</h3>
      <ul>
        {options.map((option) => (
          <li key={option.value}>
            {/* Marked rather than removed when a combination empties it: a
                facet that vanishes as you filter is harder to reason about
                than one that reads zero. */}
            <label
              className={styles.opt}
              data-empty={
                option.count === 0 && !selected.includes(option.value) ? "" : undefined
              }
            >
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
