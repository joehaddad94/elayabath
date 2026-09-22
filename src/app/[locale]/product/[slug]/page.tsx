import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marks } from "@/components/Blueprint/Blueprint";
import { Breadcrumbs } from "@/components/Breadcrumbs/Breadcrumbs";
import { Container, Section } from "@/components/Container/Container";
import { FinishPicker } from "@/components/FinishPicker/FinishPicker";
import { Icon } from "@/components/Icon/Icon";
import { ProductGrid } from "@/components/ProductGrid/ProductGrid";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import {
  getCategory,
  getFinishesFor,
  getProduct,
  getProducts,
  getRelatedProducts,
} from "@/lib/catalogue";
import { format, getDictionary } from "@/lib/i18n";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./product.module.css";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getProducts().map((product) => ({ locale, slug: product.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: `${product.name} ${product.sku}`,
    description: [
      product.name,
      product.type.name.toLowerCase(),
      product.dimensions,
      `Item code ${product.sku}.`,
    ]
      .filter(Boolean)
      .join(", "),
    openGraph: { images: [product.image.src] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale;

  const product = getProduct(slug);
  if (!product) notFound();

  const t = getDictionary(locale);
  const category = getCategory(product.categorySlug);
  const finishes = getFinishesFor(product);
  const related = getRelatedProducts(product, 4);

  const spec: Array<[string, React.ReactNode]> = [
    [t.common.itemCode, product.sku],
    [t.common.productType, product.type.name],
    [t.common.dimensions, product.dimensions ?? t.common.noneRecorded],
    [
      t.common.finishes,
      finishes.length > 0 ? String(finishes.length) : t.common.noneRecorded,
    ],
  ];
  if (product.features.length > 0) {
    spec.push([t.common.features, product.features.join(" · ")]);
  }

  return (
    <main id="main">
      <Section className={styles.crumbBar}>
        <Container>
          <Breadcrumbs
            label={t.common.breadcrumb}
            items={[
              { label: t.nav.home, href: routes.home(locale) },
              { label: t.products.title, href: routes.products(locale) },
              ...(category
                ? [
                    {
                      label: category.name,
                      href: routes.category(category.slug, locale),
                    },
                  ]
                : []),
              { label: product.name },
            ]}
          />
        </Container>
      </Section>

      {/* Two things are broken on the live version of this template and both
          are fixed here. The main product image does not render at all,
          leaving about 550px of blank space with a magnifier icon in it, on
          every one of the 596 products. And there is no way to choose a
          finish, despite the data carrying 3,729 variations. */}
      <Section tight>
        <Container className={styles.pdp}>
          <div className={styles.media}>
            <figure className={`${styles.figure} blueprint`}>
              <Image
                src={product.image.src}
                alt={product.image.alt}
                width={product.image.width}
                height={product.image.height}
                sizes="(max-width: 62rem) 100vw, 34rem"
                priority
              />
              <Marks />
            </figure>
          </div>

          <div>
            <span className={styles.kicker}>{product.type.name}</span>
            <h1 className={styles.title}>{product.name}</h1>
            <p className={styles.sku}>
              {t.common.itemCode} <b>{product.sku}</b>
            </p>

            <p className={styles.desc}>{product.description}</p>

            <FinishPicker finishes={finishes} t={t} />

            <table className={styles.spec}>
              <caption className="sr-only">{product.name}</caption>
              <tbody>
                {spec.map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">{key}</th>
                    <td>{value}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">{t.common.dataSheet}</th>
                  <td>
                    {product.datasheet ? (
                      <a className={styles.doc} href={product.datasheet} download>
                        <Icon name="download" size={15} />
                        TDS-{product.sku}.pdf
                      </a>
                    ) : (
                      <span className={styles.missing}>
                        {t.product.datasheetMissing}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* The page's single action. No price exists anywhere: 592 of the
                client's 596 products carry the placeholder "1 QAR". */}
            <div className={`${styles.quote} blueprint`}>
              <h2>{t.product.quoteHeading}</h2>
              <p>{t.product.quoteBody}</p>
              <Link
                className="btn btn-primary blueprint"
                href={routes.quote(product.sku, locale)}
              >
                {format(t.common.requestQuoteFor, { sku: product.sku })}
                <Marks />
              </Link>
              <Marks />
            </div>
          </div>
        </Container>
      </Section>

      {related.length > 0 && (
        <Section>
          <Container>
            <SectionHead
              label={t.product.related}
              count={category ? category.name : undefined}
            />
            <ProductGrid products={related} locale={locale} t={t} />
          </Container>
        </Section>
      )}
    </main>
  );
}
