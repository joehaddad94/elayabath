import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon/Icon";
import { Container } from "@/components/Container/Container";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./SiteFooter.module.css";

const SOCIAL: ReadonlyArray<{ name: IconName; label: string }> = [
  { name: "linkedin", label: "LinkedIn" },
  { name: "youtube", label: "YouTube" },
  { name: "instagram", label: "Instagram" },
  { name: "x", label: "X" },
  { name: "pinterest", label: "Pinterest" },
];

/**
 * Two changes from the live site's footer.
 *
 * "My account" is gone with the cart. "Returns & Refunds" is added: that page
 * exists on the live site and nothing anywhere links to it, which is how
 * nobody has noticed it still governs the return of VHS tapes.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const mail = t.contactAddresses;

  return (
    <footer className={styles.foot}>
      <Container>
        <div className={styles.grid}>
          <div>
            <Image
              src="/logo.png"
              alt={t.brand.name}
              width={111}
              height={54}
              className="invert-on-dark"
            />
          </div>

          <div>
            <h2>{t.footer.assistance}</h2>
            <ul>
              <li>
                <span className={styles.key}>{t.footer.technical}</span>
                <a className={styles.mail} href={`mailto:${mail.technical}`}>
                  {mail.technical}
                </a>
              </li>
              <li>
                <span className={styles.key}>{t.footer.design}</span>
                <a className={styles.mail} href={`mailto:${mail.design}`}>
                  {mail.design}
                </a>
              </li>
              <li>
                <span className={styles.key}>{t.footer.general}</span>
                <a className={styles.mail} href={`mailto:${mail.general}`}>
                  {mail.general}
                </a>
              </li>
              <li>
                {t.footer.formPrompt}{" "}
                <Link href={`${routes.contact(locale)}#enquiry`}>
                  {t.footer.formLink}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2>{t.footer.company}</h2>
            <ul>
              <li>
                <Link href={routes.products(locale)}>{t.nav.products}</Link>
              </li>
              <li>
                <Link href={routes.about(locale)}>{t.nav.about}</Link>
              </li>
              <li>
                <Link href={routes.contact(locale)}>{t.nav.contact}</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2>{t.footer.legal}</h2>
            <ul>
              <li>
                <Link href={routes.faq(locale)}>{t.footer.faq}</Link>
              </li>
              <li>
                <Link href={routes.privacy(locale)}>{t.footer.privacy}</Link>
              </li>
              <li>
                <Link href={routes.terms(locale)}>{t.footer.terms}</Link>
              </li>
              <li>
                <Link href={routes.returns(locale)}>{t.footer.returns}</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2>{t.footer.follow}</h2>
            <div className={styles.social}>
              {SOCIAL.map((item) => (
                <a
                  key={item.name}
                  className="btn btn-icon"
                  href="#"
                  aria-label={item.label}
                >
                  <Icon name={item.name} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.bottom}>{t.footer.copyright}</div>
      </Container>
    </footer>
  );
}
