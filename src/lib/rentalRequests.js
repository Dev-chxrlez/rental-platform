import { formatPrice } from "./listings";

export const rentalRequestColumns = [
  "id",
  "listing_id",
  "renter_id",
  "owner_id",
  "start_date",
  "end_date",
  "duration_days",
  "status",
  "listing_title",
  "daily_price",
  "replacement_value",
  "rental_total",
  "renter_name",
  "renter_account_type",
  "renter_business_name",
  "renter_is_verified",
  "renter_account_age_days",
  "risk_score",
  "risk_band",
  "risk_factors",
  "risk_explanation",
  "safeguard_requirements",
  "required_deposit",
  "deposit_payment_method",
  "deposit_proof_path",
  "deposit_submitted_at",
  "deposit_verified_at",
  "rental_payment_method",
  "rental_payment_proof_path",
  "rental_payment_submitted_at",
  "rental_payment_confirmed_at",
  "rule_version",
  "decided_at",
  "handed_over_at",
  "returned_at",
  "completed_at",
  "created_at",
  "updated_at",
].join(", ");

export function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function statusLabel(status) {
  return {
    pending: "Pending", accepted: "Accepted", rejected: "Rejected", cancelled: "Cancelled",
    handed_over: "Handed over", returned: "Return awaiting confirmation", completed: "Completed",
  }[status] ?? status;
}

export function riskBandLabel(band) {
  return { low: "Low", medium: "Medium", high: "High" }[band] ?? band;
}

export function factorDisplay(key, factor) {
  if (!factor) return "Not available";
  if (key === "verification") return factor.value === "verified" ? "Verified" : "Not verified";
  if (key === "replacement_value") return formatPrice(factor.value);
  if (key === "rental_duration") return `${factor.value} ${Number(factor.value) === 1 ? "day" : "days"}`;
  if (key === "history") return "Limited history (neutral)";
  return String(factor.value ?? "Not available");
}
