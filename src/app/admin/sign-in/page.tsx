import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import styles from "../admin.module.css";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main id="main" className={styles.signIn}>
      <div className={styles.signInCard}>
        <Image
          src="/logo-burgundy.png"
          alt="Elaya Bath"
          width={108}
          height={53}
          priority
        />
        <h1>Dashboard</h1>
        <p className={styles.lede}>Sign in with your staff email address.</p>
        {/* The form reads the page's query string (where to go afterwards,
            and why someone was sent back here), which is request data, so it
            renders inside a boundary and the rest of the page stays static. */}
        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
