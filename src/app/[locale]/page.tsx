import { Blueprint } from "@/components/Blueprint/Blueprint";
import { Container, Section } from "@/components/Container/Container";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";

/**
 * Placeholder. The shell around it is milestone 3; the real homepage is
 * milestone 4.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const t = getDictionary(raw);

  return (
    <main id="main">
      <Section>
        <Container>
          <h1>{t.brand.tagline}</h1>
          <p>{t.home.lede}</p>
          <Blueprint as="article">
            <p>{t.home.plateIntro}</p>
          </Blueprint>
        </Container>
      </Section>
    </main>
  );
}
