"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      setMessage("Supabase password recovery is not configured.");
      return;
    }
    fetch(`${url}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, redirect_to: `${window.location.origin}/reset-password` }),
    }).then((response) => {
      if (!response.ok) throw new Error("Password reset request failed.");
      setMessage("If the account exists, a password reset email has been sent.");
    }).catch((error: Error) => setMessage(error.message));
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-space-lg">
      <form onSubmit={submit} className="w-full max-w-md space-y-space-lg bg-surface-container-lowest border border-outline-variant rounded-xl p-space-xl shadow-sm">
        <div>
          <h1 className="font-headline-md text-on-surface">Reset your password</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Enter your work email to request a reset.</p>
        </div>
        <label className="block text-sm font-semibold text-on-surface">
          Work email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded" />
        </label>
        <button type="submit" className="w-full h-10 bg-primary-container text-on-primary rounded font-semibold">Request reset</button>
        {message && <p role="status" className="text-sm text-on-surface-variant">{message}</p>}
        <Link href="/" className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
      </form>
    </main>
  );
}
