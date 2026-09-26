"use client";

import { useState } from "react";
import { signIn, signUp } from "@/app/auth/actions";
import { buttonClass, fieldClass } from "@/components/ui";

export function AuthForm() {
  const [creating, setCreating] = useState(false);

  return (
    <form action={creating ? signUp : signIn} className="panel">
      <div className="segmented" role="group" aria-label="Account">
        <button
          type="button"
          className={creating ? undefined : "on"}
          aria-pressed={!creating}
          onClick={() => setCreating(false)}
        >
          Sign in
        </button>
        <button
          type="button"
          className={creating ? "on" : undefined}
          aria-pressed={creating}
          onClick={() => setCreating(true)}
        >
          Create account
        </button>
      </div>
      {creating ? (
        <label className="field-label">
          Name
          <input name="display_name" required autoComplete="name" className={fieldClass} />
        </label>
      ) : null}
      <label className="field-label">
        Email
        <input name="email" type="email" required autoComplete="email" className={fieldClass} />
      </label>
      <label className="field-label">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={creating ? "new-password" : "current-password"}
          className={fieldClass}
        />
      </label>
      <button type="submit" className={`${buttonClass} btn-block`}>
        {creating ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
