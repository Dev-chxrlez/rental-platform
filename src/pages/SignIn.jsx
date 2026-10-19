import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";
import FormField, { inputClassName } from "../components/FormField";
import { supabase } from "../lib/supabase";

export default function SignIn() {
  const { user, profile, isLoading, isProfileLoading, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestedDestination = location.state?.from?.pathname;

  if (!isLoading && user && !isProfileLoading) {
    return <Navigate to={requestedDestination || (profile?.is_admin ? "/admin" : "/profile")} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter both your email address and password.");
      return;
    }
    setIsSubmitting(true);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const { data: signedInProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", signInData.user.id)
      .single();
    navigate(requestedDestination || (signedInProfile?.is_admin ? "/admin" : "/profile"), { replace: true });
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up where you left off."
      description="Manage your profile and listings from a marketplace built for useful, everyday rentals."
    >
      <h2 className="font-display text-4xl font-bold tracking-[-0.035em] text-ink">Sign in</h2>
      <p className="mt-3 text-base leading-7 text-ink-muted">Use the email address connected to your account.</p>

      {!isConfigured ? (
        <div className="mt-7 rounded-xl border border-amber-300 bg-accent-soft p-4 text-sm leading-6 text-ink" role="alert">
          Supabase is not configured. Add the public project URL and publishable key to your local environment file before signing in.
        </div>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <FormField label="Email address" id="sign-in-email">
            <input id="sign-in-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Password" id="sign-in-password">
            <input id="sign-in-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClassName} />
          </FormField>
          <div className="-mt-2 text-right">
            <Link to="/forgot-password" className="text-sm font-bold text-brand-strong underline-offset-4 hover:underline">Forgot password?</Link>
          </div>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="button-primary w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      <p className="mt-7 text-sm text-ink-muted">
        New to Rental Platform?{" "}
        <Link className="font-bold text-brand-strong underline-offset-4 hover:underline" to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
