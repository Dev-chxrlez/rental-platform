import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  formatPrice,
  getListingImageUrl,
  labelFor,
  listingColumns,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
} from "../lib/listings";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export default function ListingDetails() {
  const { id } = useParams();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [listing, setListing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured for this environment.");
      setIsLoading(false);
      return;
    }
    let ignore = false;
    async function loadListing() {
      const { data, error: loadError } = await supabase
        .from("listings")
        .select(listingColumns)
        .eq("id", id)
        .single();
      if (ignore) return;
      if (loadError) setError("This listing is unavailable or no longer active.");
      else setListing(data);
      setIsLoading(false);
    }
    loadListing();
    return () => {
      ignore = true;
    };
  }, [id]);

  if (isLoading) return <p className="m-auto text-base text-ink-muted" role="status">Loading listing…</p>;
  if (error) {
    return (
      <section className="panel mx-auto w-full max-w-2xl self-start border-red-200 p-6 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-ink">Listing unavailable</h1>
        <p className="mt-4 text-red-800" role="alert">{error}</p>
        <Link to="/listings" className="mt-6 inline-flex font-bold text-brand-strong hover:underline">Back to listings</Link>
      </section>
    );
  }

  return (
    <article className="panel w-full self-start overflow-hidden lg:grid lg:grid-cols-2">
      <div className="aspect-[4/3] bg-[#ebe7df] lg:aspect-auto lg:min-h-[32rem]">
        <img src={getListingImageUrl(listing.image_path)} alt={listing.title} className="h-full w-full object-cover" />
      </div>
      <div className="p-6 sm:p-10">
        <Link to="/listings" className="text-sm font-bold text-brand-strong hover:underline">← Back to listings</Link>
        {listing.moderation_status !== "approved" && (
          <div className={`mt-6 rounded-xl border p-4 text-sm leading-6 ${listing.moderation_status === "rejected" ? "border-red-200 bg-red-50 text-red-800" : "border-[#efd8a4] bg-accent-soft text-[#76500d]"}`} role="status">
            <p className="font-black">{listing.moderation_status === "rejected" ? "Changes requested" : "Pending administrator review"}</p>
            <p className="mt-1">{listing.moderation_note || "This listing is visible only to its owner and administrators until it is approved."}</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2 text-sm text-ink-muted">
          <span>{labelFor(LISTING_CATEGORIES, listing.category)}</span>
          <span aria-hidden="true">·</span>
          <span>{labelFor(LISTING_CONDITIONS, listing.condition)}</span>
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink">{listing.title}</h1>
        <p className="mt-5 text-2xl font-black text-brand-strong">{formatPrice(listing.daily_price)} <span className="text-base font-normal text-ink-muted">/ day</span></p>
        <dl className="mt-6 border-y border-line py-4">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Replacement value</dt>
            <dd className="font-bold text-ink">{formatPrice(listing.replacement_value)}</dd>
          </div>
        </dl>
        <h2 className="mt-6 text-lg font-black text-ink">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-ink-muted">{listing.description}</p>
        <div className="mt-6 rounded-xl border border-line bg-[#f7f4ed] p-4">
          <p className="text-sm font-bold text-ink">Listed by a Rental Platform member</p>
          <Link to={`/profiles/${listing.owner_id}`} className="mt-1 inline-flex text-sm font-bold text-brand-strong hover:underline">View public rental profile</Link>
        </div>
        <div className="mt-8 border-t border-line pt-6">
          {profile?.is_admin ? (
            <div className="rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm leading-6 text-brand-strong">
              Administrator accounts can inspect listings but cannot submit rental requests.
              <Link to="/admin/requests" className="mt-2 block font-bold hover:underline">View platform rental requests</Link>
            </div>
          ) : listing.moderation_status !== "approved" ? (
            <div className="rounded-xl border border-line bg-[#f7f4ed] p-4 text-sm leading-6 text-ink-muted">
              Rental requests become available after this listing is approved.
            </div>
          ) : user?.id === listing.owner_id ? (
            <div className="rounded-xl border border-line bg-[#f7f4ed] p-4 text-sm leading-6 text-ink-muted">
              This is your listing. Rental requests from other members will appear in your approval queue.
              <Link to="/requests" className="mt-2 block font-bold text-brand-strong hover:underline">View requests</Link>
            </div>
          ) : user ? (
            <Link to={`/listings/${listing.id}/request`} className="button-primary w-full">Request rental dates</Link>
          ) : (
            <Link to="/sign-in" state={{ from: location }} className="button-primary w-full">Sign in to request</Link>
          )}
        </div>
      </div>
    </article>
  );
}
