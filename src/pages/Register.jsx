import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";
import FormField, { inputClassName } from "../components/FormField";
import { supabase } from "../lib/supabase";

const initialForm = { fullName: "", email: "", password: "", accountType: "individual", businessName: "", businessDetails: "" };

function validate(form) {
  const errors = {};
  if (form.fullName.trim().length < 2) errors.fullName = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (form.password.length < 8) errors.password = "Use at least 8 characters.";
  if (form.accountType === "sme" && form.businessName.trim().length < 2) errors.businessName = "Enter the registered or trading name of your business.";
  if (form.businessDetails.trim().length > 500) errors.businessDetails = "Keep business details to 500 characters or fewer.";
  return errors;
}

export default function Register() {
  const { user, isLoading, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && user) return <Navigate to="/profile" replace />;

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length) return;
    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/profile`,
        data: {
          full_name: form.fullName.trim(),
          account_type: form.accountType,
          business_name: form.accountType === "sme" ? form.businessName.trim() : null,
          business_details: form.accountType === "sme" ? form.businessDetails.trim() || null : null,
        },
      },
    });
    setIsSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    if (data.session) navigate("/profile", { replace: true });
    else setConfirmationEmail(form.email.trim());
  }

  if (confirmationEmail) {
    return (
      <AuthShell eyebrow="One last step" title="Check your inbox." description="Confirm your email address to finish setting up your Rental Platform account.">
        <p className="eyebrow">Email confirmation</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink">Your link is on its way.</h2>
        <p className="mt-4 break-words text-base leading-7 text-ink-muted">We sent a confirmation link to <strong className="text-ink">{confirmationEmail}</strong>. Open it to activate your account, then sign in.</p>
        <Link to="/sign-in" className="button-primary mt-7">Return to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Join the marketplace"
      title="Make better use of what’s available."
      description="Create an Individual or SME account to publish resources and manage your own listings."
    >
      <h2 className="font-display text-4xl font-bold tracking-[-0.035em] text-ink">Create your account</h2>
      <p className="mt-3 text-base leading-7 text-ink-muted">Choose the account type that reflects how you’ll use the marketplace.</p>

      {!isConfigured ? (
        <div className="mt-7 rounded-xl border border-amber-300 bg-accent-soft p-4 text-sm leading-6 text-ink" role="alert">
          Supabase is not configured. Add the public project URL and publishable key to your local environment file before registering.
        </div>
      ) : (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <fieldset>
            <legend className="text-sm font-bold text-ink">Account type</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {[
                ["individual", "Individual", "Rent for yourself"],
                ["sme", "SME", "Rent for a small or medium business"],
              ].map(([value, label, description]) => (
                <label key={value} className={`cursor-pointer rounded-xl border p-4 transition-colors ${form.accountType === value ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-white hover:border-brand/50"}`}>
                  <input type="radio" name="accountType" value={value} checked={form.accountType === value} onChange={updateField} className="mr-2 accent-[#0f766e]" />
                  <span className="font-bold text-ink">{label}</span>
                  <span className="mt-1 block pl-6 text-sm leading-5 text-ink-muted">{description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <FormField label="Full name" id="register-name" error={errors.fullName}>
            <input id="register-name" name="fullName" autoComplete="name" value={form.fullName} onChange={updateField} className={inputClassName} required />
          </FormField>
          <FormField label="Email address" id="register-email" error={errors.email}>
            <input id="register-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} className={inputClassName} required />
          </FormField>
          <FormField label="Password" id="register-password" hint="Use at least 8 characters." error={errors.password}>
            <input id="register-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} className={inputClassName} required minLength={8} />
          </FormField>

          {form.accountType === "sme" && (
            <div className="space-y-6 rounded-2xl border border-line bg-[#f7f4ed] p-4 sm:p-5">
              <FormField label="Business name" id="business-name" error={errors.businessName}>
                <input id="business-name" name="businessName" autoComplete="organization" value={form.businessName} onChange={updateField} className={inputClassName} required />
              </FormField>
              <FormField label="Business details" id="business-details" hint="Optional: briefly describe the business, industry, or rental needs." error={errors.businessDetails}>
                <textarea id="business-details" name="businessDetails" rows={4} maxLength={500} value={form.businessDetails} onChange={updateField} className={inputClassName} />
              </FormField>
            </div>
          )}

          {submitError && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{submitError}</p>}
          <button type="submit" disabled={isSubmitting} className="button-primary w-full">{isSubmitting ? "Creating account…" : "Create account"}</button>
        </form>
      )}

      <p className="mt-7 text-sm text-ink-muted">Already registered? <Link className="font-bold text-brand-strong underline-offset-4 hover:underline" to="/sign-in">Sign in</Link></p>
    </AuthShell>
  );
}
