import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";
import FormField, { inputClassName } from "../components/FormField";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const { user, isLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const linkError = useMemo(() => {
    const parameters = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return parameters.get("error_description")?.replaceAll("+", " ") || "";
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) { setError(updateError.message); return; }
    await supabase.auth.signOut();
    setIsComplete(true);
  }

  if (isComplete) return (
    <AuthShell eyebrow="Password updated" title="Your account is secure." description="Your new password is ready to use.">
      <h2 className="font-display text-4xl font-bold tracking-[-0.035em] text-ink">Password changed.</h2>
      <p className="mt-4 text-base leading-7 text-ink-muted">Sign in again using your new password.</p>
      <Link to="/sign-in" className="button-primary mt-7">Continue to sign in</Link>
    </AuthShell>
  );

  if (isLoading) return <p className="m-auto text-base text-ink-muted" role="status">Checking recovery link…</p>;
  if (!user || linkError) return (
    <AuthShell eyebrow="Recovery link" title="This link cannot be used." description="Password-reset links are temporary and can only be used once.">
      <h2 className="font-display text-4xl font-bold tracking-[-0.035em] text-ink">Request a new link.</h2>
      <p className="mt-4 text-base leading-7 text-red-800" role="alert">{linkError || "The recovery link is invalid or has expired."}</p>
      <Link to="/forgot-password" className="button-primary mt-7">Send another reset link</Link>
    </AuthShell>
  );

  return (
    <AuthShell eyebrow="Secure your account" title="Choose a new password." description="Use a password that is unique to your Rental Platform account.">
      <h2 className="font-display text-4xl font-bold tracking-[-0.035em] text-ink">Reset password</h2>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField label="New password" id="new-password" hint="Use at least 8 characters.">
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClassName} required autoFocus />
        </FormField>
        <FormField label="Confirm new password" id="confirm-new-password">
          <input id="confirm-new-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClassName} required />
        </FormField>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="button-primary w-full">{isSubmitting ? "Updating password…" : "Update password"}</button>
      </form>
    </AuthShell>
  );
}
