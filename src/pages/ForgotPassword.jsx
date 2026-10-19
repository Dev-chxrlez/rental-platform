import { useState } from "react";
import { Link } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import FormField, { inputClassName } from "../components/FormField";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const cleanEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSentTo(cleanEmail);
  }

  if (sentTo) {
    return (
      <AuthShell eyebrow="Password recovery" title="Check your inbox." description="Use the secure link in the email to choose a new password.">
        <p className="eyebrow">Recovery email sent</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink">Your reset link is on its way.</h2>
        <p className="mt-4 break-words text-base leading-7 text-ink-muted">If an account exists for <strong className="text-ink">{sentTo}</strong>, Supabase will send it a password-reset email.</p>
        <p className="mt-3 text-sm leading-6 text-ink-soft">For security, the link expires. Check your spam folder if it does not arrive shortly.</p>
        <Link to="/sign-in" className="button-primary mt-7">Return to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Account recovery" title="Get back into your account." description="We’ll send a secure password-reset link to the email connected to your account.">
      <h2 className="font-display text-4xl font-bold tracking-[-0.035em] text-ink">Forgot your password?</h2>
      <p className="mt-3 text-base leading-7 text-ink-muted">Enter your account email and follow the link we send you.</p>
      {!isSupabaseConfigured ? <p className="mt-7 rounded-xl border border-amber-300 bg-accent-soft p-4 text-sm text-ink" role="alert">Supabase is not configured for this environment.</p> : (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <FormField label="Email address" id="recovery-email">
            <input id="recovery-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} required autoFocus />
          </FormField>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="button-primary w-full">{isSubmitting ? "Sending link…" : "Send reset link"}</button>
        </form>
      )}
      <Link to="/sign-in" className="mt-7 inline-flex text-sm font-bold text-brand-strong hover:underline">← Back to sign in</Link>
    </AuthShell>
  );
}
