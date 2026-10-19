import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FormField, { inputClassName } from "../components/FormField";
import ProfileAvatar from "../components/ProfileAvatar";
import { supabase } from "../lib/supabase";

const profileColumns =
  "id, full_name, account_type, business_name, business_details, introduction, avatar_path, public_city, public_region, occupation, industry, created_at, updated_at";

function extensionFor(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function validate(profile, photo) {
  const errors = {};
  if (profile.full_name.trim().length < 2) errors.full_name = "Enter your full name.";
  if (profile.account_type === "sme" && (profile.business_name ?? "").trim().length < 2) {
    errors.business_name = "Enter the registered or trading name of your business.";
  }
  if ((profile.business_details ?? "").trim().length > 500) {
    errors.business_details = "Keep business details to 500 characters or fewer.";
  }
  if ((profile.introduction ?? "").trim().length > 300) {
    errors.introduction = "Keep your introduction to 300 characters or fewer.";
  }
  for (const [field, label, maximum] of [
    ["public_city", "city or municipality", 100],
    ["public_region", "province or region", 100],
    ["occupation", "occupation or role", 120],
    ["industry", "industry", 120],
  ]) {
    const length = (profile[field] ?? "").trim().length;
    if (length === 1 || length > maximum) {
      errors[field] = `Enter a ${label} between 2 and ${maximum} characters, or leave it blank.`;
    }
  }
  if (photo) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      errors.photo = "Use a JPG, PNG, or WebP image.";
    } else if (photo.size > 2 * 1024 * 1024) {
      errors.photo = "Use an image no larger than 2 MB.";
    }
  }
  return errors;
}

export default function Profile() {
  const { user, isConfigured, refreshProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const loadProfile = useCallback(async () => {
    if (!isConfigured || !user) {
      setIsLoading(false);
      setPageError("Supabase is not configured for this environment.");
      return;
    }

    setIsLoading(true);
    setPageError("");
    const { data, error } = await supabase
      .from("profiles")
      .select(profileColumns)
      .eq("id", user.id)
      .single();

    if (error) {
      setPageError(
        error.code === "PGRST116"
          ? "Your profile was not found. Confirm that the profile migrations have been applied to this Supabase project."
          : error.message,
      );
    } else {
      setProfile(data);
    }
    setIsLoading(false);
  }, [isConfigured, user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function updateField(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setSuccess("");
  }

  function updatePhoto(event) {
    setPhoto(event.target.files?.[0] ?? null);
    setRemovePhoto(false);
    setErrors((current) => ({ ...current, photo: "" }));
    setSuccess("");
  }

  function markPhotoForRemoval() {
    setPhoto(null);
    setRemovePhoto(true);
    setErrors((current) => ({ ...current, photo: "" }));
    setSuccess("");
  }

  async function removeStoredPhoto(path) {
    if (!path) return null;
    const { error } = await supabase.storage.from("profile-images").remove([path]);
    return error;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(profile, photo);
    setErrors(nextErrors);
    setPageError("");
    setSuccess("");
    if (Object.keys(nextErrors).length) return;

    setIsSaving(true);
    let uploadedPath = "";
    if (photo) {
      uploadedPath = `${user.id}/${crypto.randomUUID()}.${extensionFor(photo)}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(uploadedPath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) {
        setPageError(`Profile photo upload failed: ${uploadError.message}`);
        setIsSaving(false);
        return;
      }
    }

    const previousAvatarPath = profile.avatar_path;
    const updates = {
      full_name: profile.full_name.trim(),
      account_type: profile.account_type,
      business_name: profile.account_type === "sme" ? profile.business_name.trim() : null,
      business_details: profile.account_type === "sme" ? profile.business_details?.trim() || null : null,
      introduction: profile.introduction?.trim() || null,
      avatar_path: removePhoto ? null : uploadedPath || previousAvatarPath,
      public_city: profile.public_city?.trim() || null,
      public_region: profile.public_region?.trim() || null,
      occupation: profile.account_type === "individual" ? profile.occupation?.trim() || null : null,
      industry: profile.account_type === "sme" ? profile.industry?.trim() || null : null,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select(profileColumns)
      .single();

    if (error) {
      if (uploadedPath) await removeStoredPhoto(uploadedPath);
      setPageError(error.message);
      setIsSaving(false);
      return;
    }

    let cleanupError = null;
    if (previousAvatarPath && (uploadedPath || removePhoto)) {
      cleanupError = await removeStoredPhoto(previousAvatarPath);
    }
    setProfile(data);
    await refreshProfile();
    setPhoto(null);
    setRemovePhoto(false);
    setSuccess(cleanupError ? "Profile saved, but the previous photo could not be removed from Storage." : "Profile saved.");
    setIsSaving(false);
  }

  if (isLoading) return <p className="m-auto text-base text-ink-muted" role="status">Loading your profile…</p>;

  if (pageError && !profile) {
    return (
      <section className="panel mx-auto w-full max-w-2xl self-start border-red-200 p-6 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-ink">Profile unavailable</h1>
        <p className="mt-4 text-base leading-7 text-red-800" role="alert">{pageError}</p>
        <button type="button" onClick={loadProfile} className="button-primary mt-6">Try again</button>
      </section>
    );
  }

  const displayedAvatarPath = removePhoto ? "" : profile.avatar_path;

  return (
    <div className="w-full self-start">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Private account settings</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink sm:text-5xl">Your profile settings</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">Manage private account details and choose what appears on your public rental profile.</p>
        </div>
        <Link to={`/profiles/${user.id}`} className="button-secondary shrink-0">View public profile</Link>
      </div>

      <form className="mt-8 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]" onSubmit={handleSubmit} noValidate>
        <section className="panel h-fit p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-ink">Public profile details</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">Your photo, display name, introduction, general location, work details, account type, and member-since date can be seen by marketplace visitors.</p>

          <div className="mt-6 flex flex-col items-start gap-4 min-[420px]:flex-row min-[420px]:items-center">
            <ProfileAvatar name={profile.full_name} path={displayedAvatarPath} previewUrl={previewUrl} />
            <div className="flex flex-wrap gap-2">
              {(profile.avatar_path || photo) && !removePhoto && (
                <button type="button" onClick={markPhotoForRemoval} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50">Remove photo</button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <FormField label="Profile photo" id="profile-photo" hint="Optional JPG, PNG, or WebP image, up to 2 MB." error={errors.photo}>
              <input id="profile-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={updatePhoto} className="block w-full rounded-xl border border-line bg-white p-2 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-bold file:text-brand-strong hover:file:bg-[#cbe9e2]" />
            </FormField>
          </div>

          <div className="mt-6">
            <FormField label="Short introduction" id="profile-introduction" hint="Share a little about what you rent or what you usually need. Maximum 300 characters." error={errors.introduction}>
              <textarea id="profile-introduction" name="introduction" rows={5} maxLength={300} value={profile.introduction ?? ""} onChange={updateField} className={inputClassName} />
            </FormField>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <h3 className="text-lg font-black text-ink">Public trust details</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">Share only a general area. Do not enter a street address, unit number, or other precise home location.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <FormField label="City or municipality" id="profile-public-city" error={errors.public_city}>
                <input id="profile-public-city" name="public_city" autoComplete="address-level2" maxLength={100} value={profile.public_city ?? ""} onChange={updateField} className={inputClassName} placeholder="For example, Cebu City" />
              </FormField>
              <FormField label="Province or region" id="profile-public-region" error={errors.public_region}>
                <input id="profile-public-region" name="public_region" autoComplete="address-level1" maxLength={100} value={profile.public_region ?? ""} onChange={updateField} className={inputClassName} placeholder="For example, Central Visayas" />
              </FormField>
            </div>
            <div className="mt-5">
              {profile.account_type === "individual" ? (
                <FormField label="Occupation or role" id="profile-occupation" hint="Optional and self-declared. Do not include employer contact details." error={errors.occupation}>
                  <input id="profile-occupation" name="occupation" maxLength={120} value={profile.occupation ?? ""} onChange={updateField} className={inputClassName} placeholder="For example, Event coordinator" />
                </FormField>
              ) : (
                <FormField label="Business industry" id="profile-industry" hint="Optional and self-declared." error={errors.industry}>
                  <input id="profile-industry" name="industry" maxLength={120} value={profile.industry ?? ""} onChange={updateField} className={inputClassName} placeholder="For example, Construction services" />
                </FormField>
              )}
            </div>
          </div>
        </section>

        <section className="panel p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-ink">Account details</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">Your email remains private and is never included in the public profile.</p>
          <div className="mt-7 space-y-6">
            <FormField label="Email address" id="profile-email" hint="Email changes are managed separately through Supabase Auth.">
              <input id="profile-email" type="email" value={user.email ?? ""} readOnly disabled className={inputClassName} />
            </FormField>
            <FormField label="Full name" id="profile-name" hint="For Individual accounts, this is your public display name." error={errors.full_name}>
              <input id="profile-name" name="full_name" autoComplete="name" value={profile.full_name} onChange={updateField} className={inputClassName} required />
            </FormField>
            <FormField label="Account type" id="profile-account-type">
              <select id="profile-account-type" name="account_type" value={profile.account_type} onChange={updateField} className={inputClassName}>
                <option value="individual">Individual</option>
                <option value="sme">SME</option>
              </select>
            </FormField>

            {profile.account_type === "sme" && (
              <div className="space-y-6 rounded-xl border border-line bg-[#f7f4ed] p-4 sm:p-5">
                <FormField label="Business name" id="profile-business-name" hint="This becomes the public display name for an SME account." error={errors.business_name}>
                  <input id="profile-business-name" name="business_name" autoComplete="organization" value={profile.business_name ?? ""} onChange={updateField} className={inputClassName} required />
                </FormField>
                <FormField label="Business details" id="profile-business-details" hint="Private account information. It is not shown on the public rental profile." error={errors.business_details}>
                  <textarea id="profile-business-details" name="business_details" rows={4} maxLength={500} value={profile.business_details ?? ""} onChange={updateField} className={inputClassName} />
                </FormField>
              </div>
            )}

            {pageError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{pageError}</p>}
            {success && <p className="rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm text-brand-strong" role="status">{success}</p>}
            <button type="submit" disabled={isSaving} className="button-primary w-full">{isSaving ? "Saving…" : "Save profile"}</button>
          </div>
        </section>
      </form>
    </div>
  );
}
