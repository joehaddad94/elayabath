import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs/Breadcrumbs";
import { Container, Section } from "@/components/Container/Container";
import styles from "./PageHead.module.css";

/**
 * The band every inner page opens with when it has no photograph: a
 * breadcrumb, a title and a line of context, closed with a hairline.
 *
 * A component rather than four copies of the same CSS module, which is how
 * the same heading ends up three different sizes across a site.
 */
export function PageHead({
  title,
  lede,
  crumbs,
  crumbLabel,
}: {
  title: string;
  lede?: string;
  crumbs: Crumb[];
  crumbLabel: string;
}) {
  return (
    <Section className={styles.head}>
      <Container>
        <Breadcrumbs label={crumbLabel} items={crumbs} />
        <h1 className={styles.title}>{title}</h1>
        {lede && <p className={styles.lede}>{lede}</p>}
      </Container>
    </Section>
  );
}
