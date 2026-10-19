import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import ListingCard from "../components/ListingCard";
import { listingColumns } from "../lib/listings";
import { supabase } from "../lib/supabase";

export default function AdminListingReview() {
  const { profile, isProfileLoading } = useAuth();
  const [listings, setListings] = useState([]);
  const [notes, setNotes] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(async () => {
    if (!profile?.is_admin) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("listings")
      .select(listingColumns)
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: true });
    if (loadError) setError(loadError.message);
    else setListings(data ?? []);
    setIsLoading(false);
  }, [profile?.is_admin]);

  useEffect(() => {
    if (!isProfileLoading) loadQueue();
  }, [isProfileLoading, loadQueue]);

  async function review(listing, decision) {
    const note = notes[listing.id]?.trim() ?? "";
    if (decision === "rejected" && !note) {
      setError("Add a review note so the owner knows what to change.");
      return;
    }

    setReviewingId(listing.id);
    setError("");
    setMessage("");
    const { error: reviewError } = await supabase.rpc("review_listing", {
      p_listing_id: listing.id,
      p_decision: decision,
      p_note: decision === "rejected" ? note : null,
    });

    if (reviewError) {
      setError(reviewError.message);
      setReviewingId("");
      return;
    }

    setListings((current) => current.filter((item) => item.id !== listing.id));
    setNotes((current) => {
      const next = { ...current };
      delete next[listing.id];
      return next;
    });
    setMessage(decision === "approved" ? `“${listing.title}” is now live.` : `“${listing.title}” was returned to its owner.`);
    setReviewingId("");
  }

  if (isProfileLoading || isLoading) {
    return <p className="m-auto text-base text-ink-muted" role="status">Loading the review queue…</p>;
  }

  if (!profile?.is_admin) {
    return (
      <section className="panel mx-auto w-full max-w-2xl self-start border-red-200 p-6 sm:p-10">
        <p className="eyebrow">Restricted</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Administrator access required</h1>
        <p className="mt-4 text-sm leading-6 text-ink-muted">Your account does not have permission to review marketplace listings.</p>
      </section>
    );
  }

  return (
    <section className="w-full self-start">
      <div>
        <p className="eyebrow">Administration</p>
        <h1 className="mt-3 break-words font-display text-3xl font-bold tracking-[-0.035em] text-ink sm:text-5xl">Listing review queue</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">Check listing details and images before approving them for the public marketplace.</p>
      </div>

      {message && <p className="mt-6 rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm text-brand-strong" role="status">{message}</p>}
      {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}

      {listings.length === 0 && !error ? (
        <div className="empty-state mt-8 sm:p-12">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-2xl text-brand" aria-hidden="true">✓</div>
          <h2 className="mt-5 font-display text-3xl font-bold text-ink">Queue cleared</h2>
          <p className="mx-auto mt-2 max-w-md text-base leading-7 text-ink-muted">There are no listings waiting for review.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              actions={
                <div>
                  <label htmlFor={`review-note-${listing.id}`} className="text-sm font-bold text-ink">Rejection note</label>
                  <textarea
                    id={`review-note-${listing.id}`}
                    value={notes[listing.id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [listing.id]: event.target.value }))}
                    maxLength={500}
                    rows={3}
                    placeholder="Explain what needs to change"
                    className="mt-2 w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <div className="mt-3 grid gap-2 min-[420px]:grid-cols-2">
                    <button type="button" onClick={() => review(listing, "rejected")} disabled={Boolean(reviewingId)} className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">Request changes</button>
                    <button type="button" onClick={() => review(listing, "approved")} disabled={Boolean(reviewingId)} className="min-h-11 rounded-xl bg-brand px-3 text-sm font-bold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60">{reviewingId === listing.id ? "Saving…" : "Approve"}</button>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
