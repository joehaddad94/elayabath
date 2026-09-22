import Link from "next/link";
import { Container, Section } from "@/components/Container/Container";
import { getDictionary } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";

export default function NotFound() {
  const t = getDictionary(DEFAULT_LOCALE);
  return (
    <main id="main">
      <Section>
        <Container>
          <h1>{t.notFound.title}</h1>
          <p>{t.notFound.body}</p>
          <p>
            <Link className="btn btn-secondary" href={routes.products(DEFAULT_LOCALE)}>
              {t.common.browseProducts}
            </Link>
          </p>
        </Container>
      </Section>
    </main>
  );
}
