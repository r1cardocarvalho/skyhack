"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blankToNull, supabase } from "@/lib/trips";

function fail(code: string): never {
  redirect(`/login?error=${encodeURIComponent(code)}`);
}

export async function signUp(formData: FormData) {
  const email = blankToNull(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const displayName = blankToNull(formData.get("display_name"));
  if (!email || password.length < 6) fail("auth");

  const db = await supabase();
  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) fail("auth");

  revalidatePath("/");
  redirect("/");
}

export async function signIn(formData: FormData) {
  const email = blankToNull(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) fail("auth");

  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) fail("auth");

  revalidatePath("/");
  redirect("/");
}

export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  revalidatePath("/");
  redirect("/");
}
