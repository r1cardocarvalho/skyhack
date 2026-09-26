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
      <header className="stack">
        <h1 className="title">Account</h1>
      </header>
      <ErrorNote code={error} />
      <AuthForm />
    </Shell>
  );
}
