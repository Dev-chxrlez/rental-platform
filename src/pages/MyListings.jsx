import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ListingCard from "../components/ListingCard";
import { listingColumns } from "../lib/listings";
import { supabase } from "../lib/supabase";

export default function MyListings() {
  const { user, isConfigured } = useAuth();
  const location = useLocation();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(location.state?.message ?? "");

  const loadListings = useCallback(async () => {
    if (!isConfigured || !user) {
      setError("Supabase is not configured for this environment.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("listings")
      .select(listingColumns)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setListings(data ?? []);
    setIsLoading(false);
  }, [isConfigured, user]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function removeListing(listing) {
    if (!window.confirm(`Remove “${listing.title}”? This cannot be undone.`)) return;
    setDeletingId(listing.id);
    setError("");
    setMessage("");
    const { error: deleteError } = await supabase.from("listings").delete().eq("id", listing.id);
    if (deleteError) {
      setError(deleteError.message);
      setDeletingId("");
      return;
    }
    const { error: imageError } = await supabase.storage.from("listing-images").remove([listing.image_path]);
    setListings((current) => current.filter((item) => item.id !== listing.id));
    setMessage(imageError ? "Listing removed, but its image could not be cleaned up. Remove the orphaned file in Supabase Storage." : "Listing removed.");
    setDeletingId("");
  }

  return (
    <section className="w-full self-start">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Owner workspace</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink sm:text-5xl">Your listings</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">New and edited listings appear in Browse only after administrator approval.</p>
        </div>
        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <Link to="/payment-settings" className="button-secondary">Payment details</Link>
          <Link to="/listings/new" className="button-primary">Create listing</Link>
        </div>
      </div>
      {message && <p className="mt-6 rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm text-brand-strong" role="status">{message}</p>}
      {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {isLoading ? (
        <p className="mt-10 text-base text-ink-muted" role="status">Loading your listings…</p>
      ) : listings.length === 0 && !error ? (
        <div className="empty-state mt-8 sm:p-12">
          <h2 className="font-display text-3xl font-bold text-ink">No listings yet</h2>
          <p className="mx-auto mt-2 max-w-md text-base leading-7 text-ink-muted">Create your first listing to make an item available in the marketplace.</p>
          <Link to="/listings/new" className="button-primary mt-6">Create a listing</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} actions={
              <div className="flex gap-3">
                <Link to={`/listings/${listing.id}/edit`} className="button-secondary flex-1 px-3">Edit</Link>
                <button type="button" onClick={() => removeListing(listing)} disabled={deletingId === listing.id} className="min-h-11 flex-1 rounded-lg border border-red-200 px-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">{deletingId === listing.id ? "Removing…" : "Remove"}</button>
              </div>
            } />
          ))}
        </div>
      )}
    </section>
  );
}
