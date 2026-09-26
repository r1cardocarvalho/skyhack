import Image from "next/image";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { ErrorNote, Shell } from "@/components/shell";
import { supabase } from "@/lib/trips";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const db = await supabase();
  const { data } = await db.auth.getUser();
  if (data.user) redirect("/");

  return (
    <Shell>
      <section className="auth">
        <div className="auth-copy">
          <Image src="/brand/roava-mark.png" alt="" width={41} height={40} />
          <header className="stack">
            <h1 className="title">
              Your trip.
              <br />
              All together.
            </h1>
            <p className="lede">Travel, with less effort. Sign in to see where you are going.</p>
          </header>
          <ErrorNote code={error} />
          <AuthForm />
        </div>
        <div className="hero-media auth-media">
          <Image
            src="/brand/hero.jpg"
            alt="A traveler checking her trip on her phone at the airport"
            fill
            priority
            sizes="50vw"
          />
        </div>
      </section>
    </Shell>
  );
}
