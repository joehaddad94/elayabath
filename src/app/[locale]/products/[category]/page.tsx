import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marks } from "@/components/Blueprint/Blueprint";
import { Container, Section } from "@/components/Container/Container";
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
    description:
      category.blurb?.[0] ??
      `${category.totalInCatalogue} ${category.name.toLowerCase()} from Elaya Bath, with item codes, dimensions and finishes.`,
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

  return (
    <main id="main">
      <PageHead
        title={category.name}
        lede={
          category.blurb
            ? category.blurb[0]
            : `${category.totalInCatalogue} ${category.name.toLowerCase()} in the full catalogue, ${category.count} of them in this build.`
        }
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.products.title, href: routes.products(locale) },
          { label: category.name },
        ]}
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
              <Marks />
            </Link>
          </p>
        </Container>
      </Section>
    </main>
  );
}
