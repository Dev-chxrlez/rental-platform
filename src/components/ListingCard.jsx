import { Link } from "react-router-dom";
import {
  formatPrice,
  getListingImageUrl,
  labelFor,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  MODERATION_LABELS,
} from "../lib/listings";

export default function ListingCard({ listing, actions }) {
  return (
    <article className="market-card group/card flex min-w-0 flex-col">
      <Link to={`/listings/${listing.id}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <div className="aspect-[4/3] overflow-hidden bg-[#ebe7df]">
          <img
            src={getListingImageUrl(listing.image_path)}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="font-bold text-brand">{labelFor(LISTING_CATEGORIES, listing.category)}</span>
            <span aria-hidden="true">·</span>
            <span>{labelFor(LISTING_CONDITIONS, listing.condition)}</span>
            {!listing.is_active && (
              <span className="rounded-full bg-[#ebe7df] px-2 py-0.5 font-bold text-ink-muted">Inactive</span>
            )}
            {listing.moderation_status && listing.moderation_status !== "approved" && (
              <span className={`rounded-full px-2 py-0.5 font-bold ${listing.moderation_status === "rejected" ? "bg-red-50 text-red-700" : "bg-accent-soft text-[#8a5a08]"}`}>
                {MODERATION_LABELS[listing.moderation_status]}
              </span>
            )}
          </div>
          <h2 className="mt-2 line-clamp-2 text-xl font-black leading-snug text-ink">{listing.title}</h2>
          <p className="mt-4 text-lg font-black text-ink">
            {formatPrice(listing.daily_price)} <span className="text-sm font-medium text-ink-muted">/ day</span>
          </p>
        </div>
      </Link>
      {listing.moderation_status === "rejected" && listing.moderation_note && (
        <p className="border-t border-red-100 bg-red-50/60 px-4 py-3 text-sm leading-5 text-red-800">
          <span className="font-bold">Review note:</span> {listing.moderation_note}
        </p>
      )}
      {actions && <div className="mt-auto border-t border-line p-4">{actions}</div>}
    </article>
  );
}
