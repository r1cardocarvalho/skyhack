import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Icon } from "@/components/icons";
import { supabase } from "@/lib/trips";

export { ErrorNote, buttonClass, fieldClass } from "@/components/ui";

export async function Shell({ children }: { children: ReactNode }) {
  const db = await supabase();
  const { data } = await db.auth.getUser();
  const email = data.user?.email;

  return (
    <div className="shell">
      <div className="topbar-wrap">
        <header className="topbar">
          <Link href="/" className="brand" aria-label="Roava home">
            <Image src="/brand/roava-logo.png" alt="Roava" width={118} height={30} priority />
            <span className="tagline">Travel, with less effort.</span>
          </Link>
          {email ? (
            <form action={signOut} className="account">
              <span className="brand-note">{email}</span>
              <span className="avatar" aria-hidden="true">
                {email.charAt(0)}
              </span>
              <button type="submit" className="btn-quiet">
                <Icon name="logout" size={15} />
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="btn">
              Sign in
            </Link>
          )}
        </header>
      </div>
      <main className="page">{children}</main>
      <footer className="footer">Roava · Your trip. All together.</footer>
    </div>
  );
}
