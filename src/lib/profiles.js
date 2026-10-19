import { supabase } from "./supabase";

export function getProfileImageUrl(path) {
  if (!supabase || !path) return "";
  return supabase.storage.from("profile-images").getPublicUrl(path).data.publicUrl;
}

export function initialsFor(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join("") || "RP";
}

export function formatMemberSince(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
  }).format(new Date(value));
}

export function accountTypeLabel(value) {
  return value === "sme" ? "SME" : "Individual";
}
