import { supabase } from "./supabase";

export const LISTING_CATEGORIES = [
  { value: "equipment", label: "Tools & equipment" },
  { value: "vehicles", label: "Vehicles" },
  { value: "spaces", label: "Spaces" },
  { value: "technology", label: "Technology" },
  { value: "other", label: "Other" },
];

export const LISTING_CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export const listingColumns =
  "id, owner_id, title, category, description, daily_price, replacement_value, condition, image_path, is_active, moderation_status, moderation_note, reviewed_at, created_at, updated_at";

export const MODERATION_LABELS = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Changes requested",
};

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatPrice(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function getListingImageUrl(path) {
  if (!supabase || !path) return "";
  return supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
}

export function validateListing(values, imageRequired) {
  const errors = {};
  const dailyPrice = Number(values.dailyPrice);
  const replacementValue = Number(values.replacementValue);

  if (values.title.trim().length < 3 || values.title.trim().length > 120) {
    errors.title = "Use between 3 and 120 characters.";
  }
  if (!LISTING_CATEGORIES.some((item) => item.value === values.category)) {
    errors.category = "Choose a valid category.";
  }
  if (values.description.trim().length < 20 || values.description.trim().length > 2000) {
    errors.description = "Use between 20 and 2,000 characters.";
  }
  if (!/^\d+(\.\d{1,2})?$/.test(values.dailyPrice) || !Number.isFinite(dailyPrice) || dailyPrice <= 0 || dailyPrice > 99999999.99) {
    errors.dailyPrice = "Enter a valid daily price with no more than two decimal places.";
  }
  if (!/^\d+(\.\d{1,2})?$/.test(values.replacementValue) || !Number.isFinite(replacementValue) || replacementValue <= 0 || replacementValue > 9999999999.99) {
    errors.replacementValue = "Enter a valid replacement value with no more than two decimal places.";
  }
  if (!LISTING_CONDITIONS.some((item) => item.value === values.condition)) {
    errors.condition = "Choose a valid condition.";
  }
  if (imageRequired && !values.image) errors.image = "Choose one image for the listing.";
  if (values.image) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(values.image.type)) {
      errors.image = "Use a JPG, PNG, or WebP image.";
    } else if (values.image.size > 5 * 1024 * 1024) {
      errors.image = "Use an image no larger than 5 MB.";
    }
  }
  return errors;
}
