"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Container, Section } from "@/components/Container/Container";
import styles from "./error.module.css";

/**
 * An error boundary for the locale segment.
 *
 * Without one, an unhandled render error shows Next's own error screen: no
 * header, no footer, no fonts, no theme. That is the same defect the 404 had
 * before the catch-all route was added, and it is worth closing for the same
 * reason: a visitor who hits it should still be on the site.
 *
 * Deliberately plain. It cannot rely on the dictionary or the catalogue,
 * because whatever failed may be exactly those.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replaced by whatever reporting the client chooses. Logged rather than
    // swallowed so a production failure is not invisible.
    console.error(error);
  }, [error]);

  return (
    <main id="main">
      <Section>
        <Container>
          <h1>Something went wrong</h1>
          <p>
            That page could not be displayed. Trying again may be enough; if it
            is not, the products are a good place to start.
          </p>
          <div className={styles.actions}>
            <button className="btn btn-primary" type="button" onClick={reset}>
              Try again
            </button>
            <Link className="btn btn-secondary" href="/products">
              Browse the products
            </Link>
          </div>
        </Container>
      </Section>
    </main>
  );
}
