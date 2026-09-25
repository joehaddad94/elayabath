import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import { requireStaff } from "@/lib/admin/session";
import { signOut } from "../sign-in/actions";
import styles from "../admin.module.css";
import { AdminNav, type AdminNavItem } from "./AdminNav";

/** Sections appear here as they are built, never as dead links. */
const SECTIONS: AdminNavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/finishes", label: "Finishes" },
  { href: "/admin/homepage", label: "Homepage" },
  { href: "/admin/imports", label: "Import" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/staff", label: "Staff" },
];

/**
 * The signed-in frame. Knowing who is signed in means reading the session
 * cookie, which is request data, so it resolves inside a boundary: the
 * outer frame is static and the rest streams in, rather than the whole
 * dashboard waiting on a cookie.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<p className={styles.loading}>Loading the dashboard…</p>}>
        <SignedIn>{children}</SignedIn>
      </Suspense>
    </div>
  );
}

async function SignedIn({ children }: { children: React.ReactNode }) {
  const { email } = await requireStaff();

  return (
    <>
      <header className={styles.bar}>
        <Link href="/admin" className={styles.brand}>
          <Image src="/logo.png" alt="" width={74} height={36} className="invert-on-dark" />
          Dashboard
        </Link>
        <AdminNav items={SECTIONS} />
        <div className={styles.who}>
          <span>{email}</span>
          <ThemeToggle label="Switch to the {theme} palette" />
          <form action={signOut}>
            <button type="submit" className={styles.linkButton}>
              Sign out
            </button>
          </form>
          <Link href="/" className={styles.linkButton}>
            View site
          </Link>
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </>
  );
}
