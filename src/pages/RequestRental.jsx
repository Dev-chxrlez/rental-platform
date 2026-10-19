import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FormField, { inputClassName } from "../components/FormField";
import { formatPrice, listingColumns } from "../lib/listings";
import { supabase } from "../lib/supabase";

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function RequestRental() {
  const { id } = useParams();
  const { user, profile, isConfigured } = useAuth();
  const navigate = useNavigate();
  const today = useMemo(() => localDateString(), []);
  const [listing, setListing] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isConfigured) {
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
        .eq("is_active", true)
        .single();
      if (ignore) return;
      if (loadError) setError("This listing is unavailable or inactive.");
      else if (data.owner_id === user.id) setError("You cannot request your own listing.");
      else setListing(data);
      setIsLoading(false);
    }
    loadListing();
    return () => {
      ignore = true;
    };
  }, [id, isConfigured, user.id]);

  const duration = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  }, [endDate, startDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (profile?.is_admin) {
      setError("Administrator accounts cannot submit rental requests.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Choose both a start date and an end date.");
      return;
    }
    if (startDate < today) {
      setError("The rental start date cannot be in the past.");
      return;
    }
    if (endDate < startDate) {
      setError("The rental end date must be on or after the start date.");
      return;
    }
    if (duration > 90) {
      setError("A rental request cannot exceed 90 days.");
      return;
    }

    setIsSubmitting(true);
    const { error: requestError } = await supabase.rpc("create_rental_request", {
      p_listing_id: listing.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });
    setIsSubmitting(false);

    if (requestError) {
      setError(requestError.message);
      return;
    }

    navigate("/requests", {
      replace: true,
      state: { message: "Rental request sent. Your risk result and safeguards are ready to review." },
    });
  }

  if (profile?.is_admin) {
    return (
      <section className="panel mx-auto w-full max-w-2xl self-start p-6 sm:p-10">
        <p className="eyebrow">Administrator account</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Rental requests are read-only for admins</h1>
        <p className="mt-4 text-sm leading-6 text-ink-muted">Use the admin rental oversight page to inspect user requests and activity.</p>
        <Link to="/admin/requests" className="button-primary mt-6">View all rental requests</Link>
      </section>
    );
  }
  if (isLoading) return <p className="m-auto text-base text-ink-muted" role="status">Loading rental request…</p>;
  if (error && !listing) {
    return (
      <section className="panel mx-auto w-full max-w-2xl self-start border-red-200 p-6 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-ink">Rental request unavailable</h1>
        <p className="mt-4 text-red-800" role="alert">{error}</p>
        <Link to={`/listings/${id}`} className="mt-6 inline-flex font-bold text-brand-strong hover:underline">Back to listing</Link>
      </section>
    );
  }

  return (
    <section className="grid w-full self-start gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <aside className="panel h-fit p-6 sm:p-8">
        <p className="eyebrow">Requesting</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] text-ink">{listing.title}</h1>
        <p className="mt-4 text-xl font-black text-brand-strong">{formatPrice(listing.daily_price)} <span className="text-sm font-medium text-ink-muted">/ day</span></p>
        <p className="mt-3 text-sm leading-6 text-ink-muted">The score is calculated after submission from your stored profile, the listing replacement value, and your selected duration.</p>
      </aside>

      <div className="panel p-6 sm:p-10">
        <p className="eyebrow">Choose dates</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink">Request this rental</h2>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Start date" id="request-start-date">
              <input id="request-start-date" type="date" min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName} required />
            </FormField>
            <FormField label="End date" id="request-end-date">
              <input id="request-end-date" type="date" min={startDate || today} value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClassName} required />
            </FormField>
          </div>

          {duration > 0 && (
            <div className="rounded-xl border border-line bg-[#f7f4ed] p-4 text-sm text-ink-muted">
              <span className="font-bold text-ink">{duration} {duration === 1 ? "day" : "days"}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              Estimated rental total: <strong className="text-ink">{formatPrice(Number(listing.daily_price) * duration)}</strong>
            </div>
          )}

          <p className="text-sm leading-6 text-ink-muted">Submitting creates a pending request. The owner must accept it before the rental can proceed.</p>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to={`/listings/${id}`} className="button-secondary">Cancel</Link>
            <button type="submit" disabled={isSubmitting} className="button-primary">
              {isSubmitting ? "Sending request…" : "Send rental request"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
