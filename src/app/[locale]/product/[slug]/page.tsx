import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs/Breadcrumbs";
import { Container, Section } from "@/components/Container/Container";
import { FinishPicker } from "@/components/FinishPicker/FinishPicker";
import { Icon } from "@/components/Icon/Icon";
import { JsonLd } from "@/components/JsonLd/JsonLd";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { PreviewBanner } from "@/components/PreviewBanner/PreviewBanner";
import { ProductGrid } from "@/components/ProductGrid/ProductGrid";
import { QuoteAction } from "@/components/QuoteAction/QuoteAction";
import { ShortlistButton } from "@/components/Shortlist/ShortlistButton";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import {
  getCategory,
  getFinishesFor,
  getFeaturedProducts,
  getProduct,
  getRedirect,
  getRelatedProducts,
} from "@/lib/catalogue";
import { format, getDictionary } from "@/lib/i18n";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { getPreviewProduct } from "@/lib/preview";
import { categoryBand } from "@/lib/imagery";
import { routes } from "@/lib/routes";
import { breadcrumbSchema, canonical, productSchema } from "@/lib/seo";
import styles from "./product.module.css";

/**
 * Built ahead: the featured products only. Building every product page at
 * deploy time slows the build in step with the catalogue; the rest render on
 * their first visit and are cached from then on, which is also how a product
 * published after a deploy gets its page.
 */
export async function generateStaticParams() {
  const products = await getFeaturedProducts();
  return LOCALES.flatMap((locale) =>
    products.map((product) => ({ locale, slug: product.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
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
    alternates: canonical(routes.product(product.slug)),
    openGraph: product.image ? { images: [product.image.src] } : undefined,
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

  // In preview (draft mode, switched on only from the dashboard), staff see
  // the saved draft; everyone else, and staff outside preview, the live one.
  const { isEnabled: previewing } = await draftMode();
  const preview = previewing ? await getPreviewProduct(slug) : undefined;
  const product = preview?.product ?? (await getProduct(slug));
  if (!product) {
    // A product whose code changed keeps its old address working.
    const moved = await getRedirect(slug);
    if (moved) permanentRedirect(routes.product(moved, locale));
    notFound();
  }

  const t = getDictionary(locale);
  const discontinued = product.status === "discontinued";
  const [category, finishes, related] = await Promise.all([
    getCategory(product.categorySlug),
    getFinishesFor(product),
    getRelatedProducts(product, 4),
  ]);

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

  // Slug to the code the client quotes against, handed to the client
  // component so it never has to reach the catalogue itself.
  const codeFor = Object.fromEntries(finishes.map((f) => [f.slug, f.code]));

  const crumbs = [
    { label: t.nav.home, href: routes.home(locale) },
    { label: t.products.title, href: routes.products(locale) },
    ...(category
      ? [{ label: category.name, href: routes.category(category.slug, locale) }]
      : []),
    { label: product.name },
  ];

  return (
    <main id="main">
      {preview && <PreviewBanner productId={preview.id} />}
      <JsonLd
        graph={[
          productSchema(product, routes.product(product.slug)),
          breadcrumbSchema(crumbs.map((c) => ({ name: c.label, href: c.href }))),
        ]}
      />
      <Section className={styles.crumbBar}>
        <Container>
          <Breadcrumbs
            label={t.common.breadcrumb}
            items={[
              ...crumbs.slice(0, -1),
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
              {product.image ? (
                <Image
                  src={product.image.src}
                  alt={product.image.alt}
                  width={product.image.width}
                  height={product.image.height}
                  sizes="(max-width: 62rem) 100vw, 34rem"
                  priority
                
                />
              ) : (
                <span className={styles.noPhoto}>{t.common.noPhoto}</span>
              )}
            </figure>
          </div>

          <div>
            {/* Its page stays, so links from catalogues, emails and search
                results still land somewhere useful: here, pointing at what
                replaced it. */}
            {discontinued && (
              <p className={styles.discontinued} role="status">
                {t.product.discontinued}
              </p>
            )}
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
              <div className={styles.quoteActions}>
                <QuoteAction
                  sku={product.sku}
                  locale={locale}
                  codeFor={codeFor}
                  className="btn btn-primary blueprint"
                  label={format(t.common.requestQuoteFor, { sku: product.sku })}
                />
                {/* Specifying a bathroom means a basin, a tap and a WC, and
                    every quote button on the site carried exactly one code. */}
                <ShortlistButton
                  sku={product.sku}
                  slug={product.slug}
                  name={product.name}
                  codeFor={codeFor}
                  addLabel={t.shortlist.add}
                  addedLabel={t.shortlist.added}
                />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* The product page ran spec table straight into a grid of more
          products. A photograph between them separates "this item" from
          "other items" without a heading having to do that work alone. */}
      <PhotoBand
        image={categoryBand(product.categorySlug)}
        label={t.category.bandLabel}
        heading={t.category.bandHeading}
        actions={
          <>
            <QuoteAction
              sku={product.sku}
              locale={locale}
              codeFor={codeFor}
              className="btn btn-primary blueprint"
              label={t.common.requestQuote}
            />
            <Link className="btn btn-secondary" href={routes.catalogue(locale)}>
              {t.common.downloadCatalogue}
            </Link>
          </>
        }
      />

      {related.length > 0 && (
        <Section band>
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
