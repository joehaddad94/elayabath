import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage/LegalPage";
import doc from "@/content/legal/terms";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms governing use of the Elaya Bath website.",
};

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);

  return (
    <LegalPage
      doc={doc}
      crumbLabel={t.common.breadcrumb}
      crumbs={[
        { label: t.nav.home, href: routes.home(locale) },
        { label: doc.title },
      ]}
      onThisPage={t.legal.onThisPage}
      draftLabel={t.draft.needsLegalReview}
    />
  );
}
