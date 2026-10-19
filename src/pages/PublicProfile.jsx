import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ListingCard from "../components/ListingCard";
import ProfileAvatar from "../components/ProfileAvatar";
import { listingColumns } from "../lib/listings";
import { accountTypeLabel, formatMemberSince } from "../lib/profiles";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

function StarIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="m12 2.4 2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.21l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.4Z" fill="currentColor" />
    </svg>
  );
}

function StarRating({ rating }) {
  const numericRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${numericRating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, numericRating - star + 1)) * 100;
        return (
          <span key={star} className="relative block h-5 w-5 text-slate-300" aria-hidden="true">
            <StarIcon className="h-5 w-5" />
            <span className="absolute inset-y-0 left-0 overflow-hidden text-amber-500" style={{ width: `${fill}%` }}>
              <StarIcon className="h-5 w-5 min-w-5" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function ReputationSection({ title, perspective, average, reviewCount, completedCount, reviews, onTime, returnsRecorded }) {
  const hasReviews = Number(reviewCount) > 0;
  return (
    <section className="rounded-[1.5rem] border border-line bg-surface p-5 sm:p-6">
      <p className="eyebrow">{perspective}</p>
      <h2 className="mt-2 font-display text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-[#f7f4ed] p-4">
          <p className="text-sm text-ink-muted">Rating</p>
          {hasReviews ? (
            <div className="mt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-black text-ink">{Number(average).toFixed(1)} <span className="text-sm font-bold text-ink-muted">/ 5</span></span>
                <StarRating rating={Number(average)} />
              </div>
              <p className="mt-1 text-sm text-ink-muted">{reviewCount} {Number(reviewCount) === 1 ? "review" : "reviews"}</p>
            </div>
          ) : <p className="mt-2 font-bold text-ink">No reviews yet</p>}
        </div>
        <div className="rounded-xl border border-line bg-[#f7f4ed] p-4">
          <p className="text-sm text-ink-muted">Completed rentals</p>
          <p className="mt-1 text-2xl font-black text-ink">{completedCount}</p>
          {Number(returnsRecorded) > 0 && <p className="mt-1 text-sm text-ink-muted">{onTime} of {returnsRecorded} recorded returns on time</p>}
        </div>
      </div>
      {reviews.length > 0 && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-ink">Written reviews</h3>
          {reviews.map((review) => (
            <article key={review.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-ink">{review.reviewer_display_name}</p>
                <StarRating rating={review.rating} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{review.comment}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function publicLocation(profile) {
  return [profile.public_city, profile.public_region].filter(Boolean).join(", ");
}

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [reputation, setReputation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured for this environment.");
      setIsLoading(false);
      return;
    }

    let ignore = false;
    async function loadPublicProfile() {
      const [profileResult, listingsResult, reputationResult, reviewsResult] = await Promise.all([
        supabase.rpc("get_public_profile", { p_profile_id: id }).single(),
        supabase
          .from("listings")
          .select(listingColumns)
          .eq("owner_id", id)
          .eq("is_active", true)
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false }),
        supabase.rpc("get_public_reputation", { p_profile_id: id }).single(),
        supabase.rpc("get_public_reviews", { p_profile_id: id }),
      ]);

      if (ignore) return;
      if (profileResult.error) {
        setError(
          profileResult.error.code === "PGRST116"
            ? "This public profile could not be found."
            : profileResult.error.message,
        );
      } else {
        setProfile(profileResult.data);
        const secondaryError = listingsResult.error || reputationResult.error || reviewsResult.error;
        if (secondaryError) setError(secondaryError.message);
        if (!listingsResult.error) setListings(listingsResult.data ?? []);
        if (!reputationResult.error) setReputation(reputationResult.data);
        if (!reviewsResult.error) setReviews(reviewsResult.data ?? []);
      }
      setIsLoading(false);
    }

    loadPublicProfile();
    return () => {
      ignore = true;
    };
  }, [id]);

  if (isLoading) return <p className="m-auto text-base text-ink-muted" role="status">Loading public profile…</p>;
  if (!profile) {
    return (
      <section className="panel mx-auto w-full max-w-2xl self-start border-red-200 p-6 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-ink">Public profile unavailable</h1>
        <p className="mt-4 text-red-800" role="alert">{error}</p>
        <Link to="/listings" className="mt-6 inline-flex font-bold text-brand-strong hover:underline">Browse listings</Link>
      </section>
    );
  }

  return (
    <div className="w-full self-start">
      <section className="panel overflow-hidden">
        <div className="bg-ink px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ProfileAvatar name={profile.display_name} path={profile.avatar_path} className="h-28 w-28 text-3xl" />
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#77d1c6]">Public rental profile</p>
              <h1 className="mt-2 break-words font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl">{profile.display_name}</h1>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-300">
                <span>{accountTypeLabel(profile.account_type)}</span>
                <span aria-hidden="true">·</span>
                <span>Member since {formatMemberSince(profile.member_since)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-ink">About this member</h2>
            <span className="rounded-full bg-[#f1eee7] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Member-provided details</span>
          </div>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-base leading-7 text-ink-muted">
            {profile.introduction || "This member has not added an introduction yet."}
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-[#f7f4ed] p-4">
              <dt className="text-sm font-bold text-ink">{profile.account_type === "sme" ? "Business location" : "Based in"}</dt>
              <dd className="mt-1 text-sm text-ink-muted">{publicLocation(profile) || "Not provided"}</dd>
            </div>
            <div className="rounded-xl border border-line bg-[#f7f4ed] p-4">
              <dt className="text-sm font-bold text-ink">{profile.account_type === "sme" ? "Industry" : "Occupation or role"}</dt>
              <dd className="mt-1 text-sm text-ink-muted">{(profile.account_type === "sme" ? profile.industry : profile.occupation) || "Not provided"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-ink-soft">Location and work details are self-declared and are not verification badges.</p>
          {user?.id === profile.id && <Link to="/profile" className="button-secondary mt-6">Edit private settings</Link>}
        </div>
      </section>

      {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">Some profile information could not be loaded: {error}</p>}

      <section className="mt-10">
        <p className="eyebrow">Trust over time</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.025em] text-ink sm:text-4xl">Rental reputation</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ReputationSection
            title="Owner reputation"
            perspective="As an owner"
            average={reputation?.owner_average_rating}
            reviewCount={reputation?.owner_review_count ?? 0}
            completedCount={reputation?.completed_as_owner ?? 0}
            reviews={reviews.filter((review) => review.reviewer_role === "renter" && review.comment)}
          />
          <ReputationSection
            title="Renter reputation"
            perspective="As a renter"
            average={reputation?.renter_average_rating}
            reviewCount={reputation?.renter_review_count ?? 0}
            completedCount={reputation?.completed_as_renter ?? 0}
            onTime={reputation?.renter_on_time_returns ?? 0}
            returnsRecorded={reputation?.renter_returns_recorded ?? 0}
            reviews={reviews.filter((review) => review.reviewer_role === "owner" && review.comment)}
          />
        </div>
      </section>

      <section className="mt-10">
        <p className="eyebrow">Available now</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-ink sm:text-4xl">Active listings</h2>
          <span className="text-sm font-bold text-ink-muted">{listings.length} {listings.length === 1 ? "listing" : "listings"}</span>
        </div>
        {listings.length === 0 ? (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-line bg-surface p-7 text-center text-ink-muted">No active listings right now.</div>
        ) : (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </section>
    </div>
  );
}
