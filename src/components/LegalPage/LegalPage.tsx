import { Fragment } from "react";
import { Container, Section } from "@/components/Container/Container";
import { Note } from "@/components/Note/Note";
import { PageHead } from "@/components/PageHead/PageHead";
import type { Crumb } from "@/components/Breadcrumbs/Breadcrumbs";
import type { LegalBlock, LegalDocument } from "@/content/legal/types";
import styles from "./LegalPage.module.css";

/**
 * Wraps every [BRACKETED] placeholder in a marked span.
 *
 * The whole reason the live site still says "[your website URL]" in clause 1
 * is that the placeholder looked like ordinary prose. Here they are
 * unmissable, so nobody publishes the draft by accident.
 */
function highlight(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, index) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <mark key={index} className={styles.placeholder}>
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "h3") return <h3>{block.text}</h3>;
  if (block.type === "ul") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{highlight(item)}</li>
        ))}
      </ul>
    );
  }
  return <p>{highlight(block.text)}</p>;
}

export function LegalPage({
  doc,
  crumbs,
  crumbLabel,
  onThisPage,
  draftLabel,
}: {
  doc: LegalDocument;
  crumbs: Crumb[];
  crumbLabel: string;
  onThisPage: string;
  draftLabel: string;
}) {
  return (
    <main id="main">
      <PageHead
        title={doc.title}
        lede={doc.lede}
        crumbs={crumbs}
        crumbLabel={crumbLabel}
      />

      <Section tight>
        <Container className={styles.grid}>
          <nav className={styles.nav} aria-label={onThisPage}>
            <ul>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.prose}>
            {/* Before any of the policy, not after it. */}
            <Note label={draftLabel} spaced={false}>
              {doc.draftNote.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{highlight(paragraph)}</p>
              ))}
            </Note>

            {doc.sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2>{section.title}</h2>
                {section.body.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </section>
            ))}
          </div>
        </Container>
      </Section>
    </main>
  );
}
