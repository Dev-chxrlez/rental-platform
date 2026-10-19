import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ListingCard from "../components/ListingCard";
import { inputClassName } from "../components/FormField";
import { listingColumns, LISTING_CATEGORIES } from "../lib/listings";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export default function BrowseListings() {
  const { profile } = useAuth();
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured for this environment.");
      setIsLoading(false);
      return;
    }
    let ignore = false;
    async function loadListings() {
      const { data, error: loadError } = await supabase
        .from("listings")
        .select(listingColumns)
        .eq("is_active", true)
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false });
      if (ignore) return;
      if (loadError) setError(loadError.message);
      else setListings(data ?? []);
      setIsLoading(false);
    }
    loadListings();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesCategory = category === "all" || listing.category === category;
      const matchesSearch = !query || listing.title.toLowerCase().includes(query) || listing.description.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, listings, search]);

  return (
    <section className="w-full self-start">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink sm:text-5xl">Find the right fit.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">Search practical resources offered for daily rental by individuals and small businesses.</p>
        </div>
        {!profile?.is_admin && <Link to="/listings/new" className="button-secondary shrink-0">List an item</Link>}
      </div>

      <div className="mt-8 grid gap-4 rounded-[1.5rem] border border-line bg-surface p-4 shadow-[0_14px_40px_rgba(18,38,63,0.06)] sm:grid-cols-[1fr_15rem] sm:p-5">
        <div>
          <label htmlFor="listing-search" className="block text-sm font-bold text-ink">Search listings</label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-soft" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path strokeLinecap="round" d="m16 16 4 4" />
              </svg>
            </span>
            <input id="listing-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What are you looking for?" className={`${inputClassName} pl-11`} />
          </div>
        </div>
        <div>
          <label htmlFor="category-filter" className="block text-sm font-bold text-ink">Category</label>
          <select id="category-filter" value={category} onChange={(event) => setCategory(event.target.value)} className={`mt-2 ${inputClassName}`}>
            <option value="all">All categories</option>
            {LISTING_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>
      {error && (
        <div className="mt-8 rounded-[1.5rem] border border-red-200 bg-[#fff8f3] p-6 sm:p-8" role="alert">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-red-700">Marketplace unavailable</p>
          <h2 className="mt-2 text-xl font-black text-ink">Listings could not be loaded.</h2>
          <p className="mt-3 break-words text-sm leading-6 text-red-800">{error}</p>
        </div>
      )}
      {isLoading ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading listings">
          {[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-[1.5rem] border border-line bg-surface" />)}
        </div>
      ) : filteredListings.length === 0 && !error ? (
        <div className="empty-state mt-8 overflow-hidden sm:p-14">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-2xl font-black text-brand" aria-hidden="true">RP</div>
          <h2 className="mt-5 font-display text-3xl font-bold text-ink">Nothing here yet.</h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-ink-muted">
            {listings.length === 0 ? "The marketplace is ready for its first listing." : "Try a different search or category."}
          </p>
          {listings.length === 0 && !profile?.is_admin && <Link to="/listings/new" className="button-primary mt-6">List the first item</Link>}
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        </div>
      )}
    </section>
  );
}
