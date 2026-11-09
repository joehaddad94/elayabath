import { notFound } from "next/navigation";
import { Container, Section } from "@/components/Container/Container";
import { EnquiryForm } from "@/components/EnquiryForm/EnquiryForm";
import { ShortlistPanel } from "@/components/Shortlist/ShortlistPanel";
import { Hero } from "@/components/Hero/Hero";
import { PhotoBand } from "@/components/PhotoBand/PhotoBand";
import { Note } from "@/components/Note/Note";
import { SectionHead } from "@/components/SectionHead/SectionHead";
import { isLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./contact.module.css";
import { photoFor } from "@/lib/site-content/fields";
import { getSiteContent, getSiteDictionary, pageMetadata } from "@/lib/site-content/read";

export function generateMetadata() {
  return pageMetadata("contact", routes.contact());
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const [t, content] = await Promise.all([getSiteDictionary(locale), getSiteContent()]);
  const mail = t.contactAddresses;

  // The live site splits these across three places: two regional addresses on
  // the contact page, three department addresses in the footer, and the form
  // on a fourth page that only the footer links to.
  const contacts = [
    {
      region: t.contact.meaRegion,
      heading: t.contact.regionalOffice,
      body: t.contact.meaBody,
      email: mail.mea,
    },
    {
      region: t.contact.europeRegion,
      heading: t.contact.regionalOffice,
      body: t.contact.europeBody,
      email: mail.europe,
    },
    {
      region: t.contact.technicalRegion,
      heading: t.contact.technicalHeading,
      body: t.contact.technicalBody,
      email: mail.technical,
    },
    {
      region: t.contact.designRegion,
      heading: t.contact.designHeading,
      body: t.contact.designBody,
      email: mail.design,
    },
    {
      region: t.contact.generalRegion,
      heading: t.contact.generalHeading,
      body: t.contact.generalBody,
      email: mail.general,
    },
  ];

  return (
    <main id="main">
      <Hero
        compact
        title={t.contact.title}
        image={photoFor(content, "photo.contact.banner")}
        crumbLabel={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.home, href: routes.home(locale) },
          { label: t.nav.contact },
        ]}
      />

      <Section tight>
        <Container>
          <SectionHead
            label={t.contact.regionalHeading}
            count={t.contact.regionalLabel}
          />
          <p className={styles.body}>{t.contact.regionalBody}</p>

          <div className={styles.grid}>
            {contacts.map((contact) => (
              <div
                key={contact.email + contact.region}
                className={`card blueprint ${styles.card}`}
              >
                <span className={styles.region}>{contact.region}</span>
                <h3 className={styles.heading}>{contact.heading}</h3>
                <p className={styles.note}>{contact.body}</p>
                <a className={styles.mail} href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
                <a
                  className={`btn btn-secondary ${styles.cta}`}
                  href={`mailto:${contact.email}`}
                >
                  {t.contact.sendEmail}
                </a>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Between the offices and the form: it separates "who to reach" from
          "send an enquiry", which a heading alone was doing. Not the hero's
          photograph repeated. */}
      <PhotoBand
        image={photoFor(content, "photo.contact.band")}
        label={t.contact.formLabel}
        heading={t.contact.formHeading}
      />

      <Section id="enquiry" band>
        <Container>
          <SectionHead
            label={t.contact.formHeading}
            count={t.contact.formLabel}
          />
          <p className={styles.body}>{t.contact.formBody}</p>

          <Note label={t.contact.prototypeLabel}>
            <p>{t.contact.prototypeBody}</p>
          </Note>

          <ShortlistPanel locale={locale} t={t} />
          <EnquiryForm t={t} />
        </Container>
      </Section>
    </main>
  );
}
