import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container, Section } from "@/components/Container/Container";
import { PageHead } from "@/components/PageHead/PageHead";
import { SearchBox } from "@/components/SearchBox/SearchBox";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical(routes.search()),
  title: "Search",
  description:
    "Find a product by name, item code, type or category across the Elaya Bath range.",
  // Nothing here is worth indexing on its own: the products it points at are.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);

  return (
    <main id="main">
      <PageHead
        title={t.search.title}
        lede={t.search.hint}
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.search.title },
        ]}
      />

      <Section tight>
        <Container>
          {/* SearchBox reads ?q= to seed itself. Without a boundary that
              would opt this route out of prerendering; with one it stays
              static and the field fills in on the client. */}
          <Suspense fallback={null}>
            <SearchBox locale={locale} t={t} />
          </Suspense>
        </Container>
      </Section>
    </main>
  );
}
