import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FormField, { inputClassName } from "../components/FormField";
import {
  getListingImageUrl,
  listingColumns,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  validateListing,
} from "../lib/listings";
import { supabase } from "../lib/supabase";

const initialValues = {
  title: "",
  category: "equipment",
  description: "",
  dailyPrice: "",
  replacementValue: "",
  condition: "good",
  image: null,
};

function extensionFor(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export default function ListingEditor() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [existingImagePath, setExistingImagePath] = useState("");
  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const previewUrl = useMemo(
    () => (values.image ? URL.createObjectURL(values.image) : ""),
    [values.image],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!isEditing || !isConfigured || !user) return;
    let ignore = false;

    async function loadListing() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select(listingColumns)
        .eq("id", id)
        .eq("owner_id", user.id)
        .single();

      if (ignore) return;
      if (error) setPageError("This listing could not be loaded or does not belong to you.");
      else {
        setValues({
          title: data.title,
          category: data.category,
          description: data.description,
          dailyPrice: String(data.daily_price),
          replacementValue: String(data.replacement_value),
          condition: data.condition,
          image: null,
        });
        setExistingImagePath(data.image_path);
      }
      setIsLoading(false);
    }

    loadListing();
    return () => {
      ignore = true;
    };
  }, [id, isConfigured, isEditing, user]);

  function updateField(event) {
    const { name, value, files } = event.target;
    if ((name === "dailyPrice" || name === "replacementValue") && !/^\d*(\.\d{0,2})?$/.test(value.replace(/,/g, ""))) return;
    const nextValue = name === "dailyPrice" || name === "replacementValue" ? value.replace(/,/g, "") : value;
    setValues((current) => ({ ...current, [name]: files ? files[0] ?? null : nextValue }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function normalizeMoneyField(event) {
    const { name, value } = event.target;
    if (!value || !Number.isFinite(Number(value))) return;
    setValues((current) => ({ ...current, [name]: Number(value).toFixed(2) }));
  }

  async function removeUploadedImage(path) {
    if (path) await supabase.storage.from("listing-images").remove([path]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateListing(values, !isEditing);
    setErrors(nextErrors);
    setPageError("");
    if (Object.keys(nextErrors).length) return;

    setIsSaving(true);
    let uploadedPath = "";

    if (values.image) {
      uploadedPath = `${user.id}/${crypto.randomUUID()}.${extensionFor(values.image)}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(uploadedPath, values.image, { contentType: values.image.type, upsert: false });
      if (uploadError) {
        setPageError(`Image upload failed: ${uploadError.message}`);
        setIsSaving(false);
        return;
      }
    }

    const payload = {
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim(),
      daily_price: Math.round(Number(values.dailyPrice) * 100) / 100,
      replacement_value: Math.round(Number(values.replacementValue) * 100) / 100,
      condition: values.condition,
      image_path: uploadedPath || existingImagePath,
    };

    const query = isEditing
      ? supabase.from("listings").update(payload).eq("id", id).select(listingColumns).single()
      : supabase.from("listings").insert(payload).select(listingColumns).single();
    const { error: saveError } = await query;

    if (saveError) {
      await removeUploadedImage(uploadedPath);
      setPageError(saveError.message);
      setIsSaving(false);
      return;
    }

    if (uploadedPath && existingImagePath) await removeUploadedImage(existingImagePath);
    navigate("/my-listings", {
      replace: true,
      state: { message: isEditing ? "Listing updated and sent for admin review." : "Listing submitted for admin review." },
    });
  }

  if (isLoading) return <p className="m-auto text-base text-ink-muted" role="status">Loading listing…</p>;

  if (!isConfigured || (pageError && isEditing && !existingImagePath)) {
    return (
      <section className="panel mx-auto w-full max-w-2xl self-start border-red-200 p-6 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-ink">Listing unavailable</h1>
        <p className="mt-4 text-red-800" role="alert">
          {pageError || "Supabase is not configured for this environment."}
        </p>
        <Link to="/my-listings" className="mt-6 inline-flex font-bold text-brand-strong hover:underline">Back to your listings</Link>
      </section>
    );
  }

  return (
    <section className="panel mx-auto w-full max-w-2xl self-start p-6 sm:p-10">
      <p className="eyebrow">Your listings</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink">
        {isEditing ? "Edit listing" : "Create a listing"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-ink-muted">
        {isEditing
          ? "Saving content changes sends the listing back to an administrator for approval."
          : "An administrator will review your listing before it appears in the marketplace."}
      </p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
        <FormField label="Title" id="listing-title" error={errors.title}>
          <input id="listing-title" name="title" value={values.title} onChange={updateField} maxLength={120} className={inputClassName} required />
        </FormField>
        <FormField label="Category" id="listing-category" error={errors.category}>
          <select id="listing-category" name="category" value={values.category} onChange={updateField} className={inputClassName}>
            {LISTING_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </FormField>
        <FormField label="Description" id="listing-description" hint="Describe what is included and any important usage details." error={errors.description}>
          <textarea id="listing-description" name="description" rows={6} value={values.description} onChange={updateField} maxLength={2000} className={inputClassName} required />
        </FormField>
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField label="Daily price (PHP)" id="daily-price" hint="Enter pesos with up to two decimal places." error={errors.dailyPrice}>
            <input id="daily-price" name="dailyPrice" type="text" inputMode="decimal" value={values.dailyPrice} onChange={updateField} onBlur={normalizeMoneyField} className={inputClassName} placeholder="200.00" required />
          </FormField>
          <FormField label="Replacement value (PHP)" id="replacement-value" hint="Enter pesos with up to two decimal places." error={errors.replacementValue}>
            <input id="replacement-value" name="replacementValue" type="text" inputMode="decimal" value={values.replacementValue} onChange={updateField} onBlur={normalizeMoneyField} className={inputClassName} placeholder="10000.00" required />
          </FormField>
        </div>
        <FormField label="Condition" id="listing-condition" error={errors.condition}>
          <select id="listing-condition" name="condition" value={values.condition} onChange={updateField} className={inputClassName}>
            {LISTING_CONDITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </FormField>
        <FormField label={isEditing ? "Replace image" : "Image"} id="listing-image" hint="One JPG, PNG, or WebP image, up to 5 MB." error={errors.image}>
          <input id="listing-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={updateField} className="block w-full rounded-xl border border-line bg-white p-2 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-bold file:text-brand-strong hover:file:bg-[#cbe9e2]" required={!isEditing} />
        </FormField>
        {(previewUrl || existingImagePath) && (
          <img src={previewUrl || getListingImageUrl(existingImagePath)} alt="Listing preview" className="aspect-[4/3] w-full rounded-xl border border-line object-cover sm:max-w-sm" />
        )}

        {pageError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{pageError}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link to="/my-listings" className="button-secondary">Cancel</Link>
          <button type="submit" disabled={isSaving} className="button-primary">
            {isSaving ? "Saving…" : isEditing ? "Save and resubmit" : "Submit for review"}
          </button>
        </div>
      </form>
    </section>
  );
}
