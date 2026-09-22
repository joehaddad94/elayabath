import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { JsonLd } from "@/components/JsonLd/JsonLd";
import { PageHead } from "@/components/PageHead/PageHead";
import { ProductBrowser } from "@/components/ProductBrowser/ProductBrowser";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import {
  getCategories,
  getCategory,
  getFinish,
  getProductsInCategory,
} from "@/lib/catalogue";
import { getDictionary } from "@/lib/i18n";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import {
  breadcrumbSchema,
  canonical,
  categorySchema,
  clampDescription,
} from "@/lib/seo";
import type { Finish } from "@/lib/types";
import styles from "./category.module.css";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getCategories().map((category) => ({ locale, category: category.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  return {
    title: category.name,
    // The client's blurbs run to 270-300 characters, which a result page
    // truncates mid-sentence. Trimmed to a whole sentence under the limit,
    // falling back to a generated line where the blurb has no sentence break.
    description: clampDescription(
      category.blurb?.[0] ??
        `${category.totalInCatalogue} ${category.name.toLowerCase()} from Elaya Bath, with item codes, dimensions and finishes.`,
    ),
    alternates: canonical(routes.category(category.slug)),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale: rawLocale, category: slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;

  const category = getCategory(slug);
  if (!category) notFound();

  const t = getDictionary(locale);
  const products = getProductsInCategory(slug);

  // Only the finishes this category actually contains, so the filter never
  // offers a colour that would return nothing.
  const finishes = category.finishes
    .map((finishSlug) => getFinish(finishSlug))
    .filter((f): f is Finish => Boolean(f));

  const crumbs = [
    { name: t.nav.home, href: routes.home(locale) },
    { name: t.products.title, href: routes.products(locale) },
    { name: category.name },
  ];

  return (
    <main id="main">
      <JsonLd
        graph={[
          categorySchema(
            category,
            routes.category(category.slug),
            products.map((p) => routes.product(p.slug)),
          ),
          breadcrumbSchema(crumbs),
        ]}
      />
      <PageHead
        title={category.name}
        lede={
          category.blurb
            ? category.blurb[0]
            : `${category.totalInCatalogue} ${category.name.toLowerCase()} in the full catalogue, ${category.count} of them in this build.`
        }
        crumbLabel={t.common.breadcrumb}
        crumbs={crumbs.map((c) => ({ label: c.name, href: c.href }))}
      />

      <Section tight>
        <Container>
          <ProductBrowser
            category={category}
            products={products}
            finishes={finishes}
            locale={locale}
            t={t}
          />
        </Container>
      </Section>

      <Section band>
        <Container>
          <SectionHead label={t.product.quoteHeading} />
          <p className={styles.lede}>{t.product.quoteBody}</p>
          <p>
            <Link
              className="btn btn-primary blueprint"
              href={`${routes.contact(locale)}#enquiry`}
            >
              {t.common.requestQuote}
            </Link>
          </p>
        </Container>
      </Section>
    </main>
  );
}
