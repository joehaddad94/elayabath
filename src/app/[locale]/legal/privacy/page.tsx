import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage/LegalPage";
import doc from "@/content/legal/privacy";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical(routes.privacy()),
  title: "Privacy Policy",
  description: "How Elaya Bath handles the information you provide through this site.",
};

export default async function PrivacyPage({
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
