"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Marks } from "@/components/Blueprint/Blueprint";
import { format, type Dictionary } from "@/lib/i18n";
import {
  getSearch,
  getServerSearch,
  subscribeToSearch,
} from "@/lib/url-filters";
import styles from "./EnquiryForm.module.css";

/**
 * The enquiry form, user interface only. There is no submit handler in this
 * build, and the page says so.
 *
 * Two things the live site's form does not do.
 *
 * It has no field for a product code, so a quote request arrives with no way
 * to tell what it is about. Here the code is carried across from the product
 * page and shown filled in.
 *
 * And it asks one set of questions of three different audiences. A homeowner
 * and a showroom visitor both want a price on one item; a contractor needs
 * quantities and a project name. Choosing the trade option reveals those two
 * fields and nothing else, which serves all three without three forms or one
 * long one that loses the homeowner.
 */
export function EnquiryForm({ t }: { t: Dictionary }) {
  const id = useId();

  // The item code arrives in the URL from a product page. Read through the
  // same store the filters use, which also avoids needing a Suspense
  // boundary around useSearchParams on a prerendered page.
  const search = useSyncExternalStore(
    subscribeToSearch,
    getSearch,
    getServerSearch,
  );
  const skuFromUrl = useMemo(
    () => new URLSearchParams(search).get("product") ?? "",
    [search],
  );

  const [skuOverride, setSkuOverride] = useState<string | null>(null);
  const [type, setType] = useState<string>("quote");

  const sku = skuOverride ?? skuFromUrl;
  const isTrade = type === "trade";

  return (
    <form
      className={styles.form}
      id="enquiry-form"
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <div className={styles.span2}>
        <label className={styles.label} htmlFor={`${id}-type`}>
          {t.contact.fType}
        </label>
        <select
          className="input"
          id={`${id}-type`}
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {Object.entries(t.contact.types).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={styles.label} htmlFor={`${id}-name`}>
          {t.contact.fName}
        </label>
        <input
          className="input"
          type="text"
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          required
        />
      </div>

      <div>
        <label className={styles.label} htmlFor={`${id}-email`}>
          {t.contact.fEmail}
        </label>
        <input
          className="input"
          type="email"
          id={`${id}-email`}
          name="email"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className={styles.label} htmlFor={`${id}-country`}>
          {t.contact.fCountry}
        </label>
        <input
          className="input"
          type="text"
          id={`${id}-country`}
          name="country"
          autoComplete="country-name"
        />
        <p className={styles.hint}>{t.contact.fCountryHint}</p>
      </div>

      <div>
        <label className={styles.label} htmlFor={`${id}-sku`}>
          {t.contact.fSku}
        </label>
        <input
          className="input"
          type="text"
          id={`${id}-sku`}
          name="sku"
          placeholder="E02-SW40034"
          value={sku}
          onChange={(event) => setSkuOverride(event.target.value)}
        />
        <p className={styles.hint}>
          {skuFromUrl && !skuOverride
            ? format(t.contact.carried, { sku: skuFromUrl })
            : t.contact.fSkuHint}
        </p>
      </div>

      <div hidden={!isTrade}>
        <label className={styles.label} htmlFor={`${id}-company`}>
          {t.contact.fCompany}
        </label>
        <input
          className="input"
          type="text"
          id={`${id}-company`}
          name="company"
          autoComplete="organization"
        />
      </div>

      <div hidden={!isTrade}>
        <label className={styles.label} htmlFor={`${id}-qty`}>
          {t.contact.fQty}
        </label>
        <input
          className="input"
          type="text"
          id={`${id}-qty`}
          name="qty"
          inputMode="numeric"
        />
      </div>

      <div className={styles.span2}>
        <label className={styles.label} htmlFor={`${id}-message`}>
          {t.contact.fMessage}
        </label>
        <textarea
          className={`input ${styles.textarea}`}
          id={`${id}-message`}
          name="message"
          rows={6}
        />
      </div>

      <div className={styles.span2}>
        <label className={styles.consent}>
          <input type="checkbox" id={`${id}-consent`} name="consent" required />
          <span>{t.contact.fConsent}</span>
        </label>
      </div>

      <div className={`${styles.span2} ${styles.actions}`}>
        <button className="btn btn-primary blueprint" type="submit" disabled>
          {t.contact.submit}
          <Marks />
        </button>
      </div>
    </form>
  );
}
