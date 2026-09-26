import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { supabase } from "@/lib/trips";

export { ErrorNote, buttonClass, fieldClass } from "@/components/ui";

export async function Shell({ children }: { children: ReactNode }) {
  const db = await supabase();
  const { data } = await db.auth.getUser();
  const email = data.user?.email;

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Trips
        </Link>
        {email ? (
          <form action={signOut} className="account">
            <span className="brand-note">{email}</span>
            <button type="submit" className="btn-quiet">
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/login" className="brand-note">
            Sign in
          </Link>
        )}
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
