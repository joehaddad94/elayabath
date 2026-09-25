import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { AddStaffForm, RemoveStaffButton } from "./StaffForms";

export const metadata: Metadata = { title: "Staff" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * Who can sign in, and who has.
 *
 * Everyone listed has equal rights, including adding and removing anyone
 * else. Under direct sign-in an address is the whole credential, so the
 * recent sign-ins are shown here: a sign-in nobody recognises should be
 * visible to the people who can remove it.
 */
export default async function StaffPage() {
  const { supabase, email: me } = await requireStaff();

  const [staff, signIns] = await Promise.all([
    supabase.from("staff").select("email, role, invited_by, created_at").order("created_at"),
    supabase
      .from("sign_in_log")
      .select("email, method, ip, at")
      .order("at", { ascending: false })
      .limit(25),
  ]);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Staff</h1>
          <p>
            Anyone on this list can sign in and edit everything. Signing in needs only the address,
            until an email provider is set up, so keep this list to personal addresses.
          </p>
        </div>
      </div>

      <AddStaffForm />

      <section className={styles.section}>
        <h2>On the list</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Address</th>
              <th scope="col">Added by</th>
              <th scope="col">Added</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(staff.data ?? []).map((s) => (
              <tr key={s.email}>
                <td>
                  {s.email}
                  {s.email === me && <span className={styles.muted}> (you)</span>}
                </td>
                <td className={styles.muted}>{s.invited_by ?? "not recorded"}</td>
                <td className={styles.muted}>{when(s.created_at)}</td>
                <td>
                  <RemoveStaffButton email={s.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2>Recent sign-ins</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Address</th>
              <th scope="col">How</th>
              <th scope="col">From</th>
            </tr>
          </thead>
          <tbody>
            {(signIns.data ?? []).map((r, i) => (
              <tr key={i}>
                <td className={styles.muted}>{when(r.at)}</td>
                <td>{r.email}</td>
                <td>
                  {r.method === "refused" ? (
                    <span className={`${styles.badge} ${styles.badgeWarn}`}>refused</span>
                  ) : (
                    r.method
                  )}
                </td>
                <td className={styles.muted}>{r.ip ?? "not recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
