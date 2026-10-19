import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ProfileAvatar from "../components/ProfileAvatar";
import RiskSummary from "../components/RiskSummary";
import { formatPrice } from "../lib/listings";
import { formatDate, rentalRequestColumns, statusLabel } from "../lib/rentalRequests";
import { supabase } from "../lib/supabase";

const statusClass = {
  pending: "border-amber-300 bg-accent-soft text-[#78500a]",
  accepted: "border-brand/25 bg-brand-soft text-brand-strong",
  rejected: "border-red-200 bg-red-50 text-red-800",
  cancelled: "border-slate-200 bg-slate-100 text-slate-700",
  handed_over: "border-sky-200 bg-sky-50 text-sky-800",
  returned: "border-violet-200 bg-violet-50 text-violet-800",
  completed: "border-brand/25 bg-brand-soft text-brand-strong",
};

const lifecycleActions = {
  owner: {
    accepted: { action: "confirm_handover", label: "Confirm handover", success: "Handover confirmed." },
    returned: { action: "confirm_receipt", label: "Confirm receipt & complete", success: "Rental completed." },
  },
  renter: {
    handed_over: { action: "mark_returned", label: "Mark item returned", success: "Return recorded. The owner can now confirm receipt." },
  },
};

function StarRating({ rating }) {
  return (
    <span className="inline-flex gap-0.5 text-lg" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-amber-500" : "text-slate-300"} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

function ReviewForm({ requestId, submitting, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(requestId, rating, comment); }} className="mt-5 rounded-xl border border-line bg-[#f7f4ed] p-4">
      <fieldset>
        <legend className="font-black text-ink">Leave your review</legend>
        <p className="mt-1 text-sm text-ink-muted">Your rating and optional comment will appear on the other member’s public profile.</p>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Choose a star rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <label key={star} className="cursor-pointer">
              <input type="radio" name={`rating-${requestId}`} value={star} checked={rating === star} onChange={() => setRating(star)} className="peer sr-only" required />
              <span className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-white text-2xl text-slate-300 transition peer-checked:border-amber-400 peer-checked:text-amber-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" aria-hidden="true">★</span>
              <span className="sr-only">{star} {star === 1 ? "star" : "stars"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`review-${requestId}`} className="mt-4 block text-sm font-bold text-ink">Written review <span className="font-normal text-ink-muted">(optional)</span></label>
      <textarea id={`review-${requestId}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} className="input mt-2 resize-y" placeholder="Share what went well during this rental." />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-ink-soft">{comment.length}/1000</span>
        <button type="submit" disabled={!rating || submitting} className="button-primary min-h-11 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Submitting…" : "Submit review"}</button>
      </div>
    </form>
  );
}

function PaymentDetails({ methods }) {
  if (!methods?.length) return (
    <section className="mt-5 rounded-xl border border-line bg-[#f7f4ed] p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-ink">Payment details</h3>
      <p className="mt-2 text-sm leading-6 text-ink-muted">The owner has not added manual payment instructions. Contact them before sending any money.</p>
    </section>
  );
  return (
    <section className="mt-5 rounded-xl border border-brand/20 bg-brand-soft/45 p-4 sm:p-5" aria-label="Owner payment details">
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-ink">Manual payment details</h3>
      <p className="mt-2 text-sm leading-6 text-ink-muted">Verify the recipient with the owner before paying. Rental Platform does not process or confirm this payment.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {methods.map((method) => (
          <article key={method.id} className="rounded-xl border border-line bg-white p-4">
            <p className="font-black text-ink">{method.method === "gcash" ? "GCash" : "Bank transfer"}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-ink-soft">Account name</dt><dd className="break-words font-bold text-ink">{method.account_name}</dd></div>
              {method.account_reference && <div><dt className="text-ink-soft">{method.method === "gcash" ? "Mobile number" : "Bank / account"}</dt><dd className="break-words font-bold text-ink">{method.account_reference}</dd></div>}
            </dl>
            {method.qr_url && <img src={method.qr_url} alt={`${method.method === "gcash" ? "GCash" : "Bank transfer"} payment QR code`} className="mt-4 aspect-square w-full max-w-56 rounded-xl border border-line object-contain p-2" />}
          </article>
        ))}
      </div>
    </section>
  );
}

function PaymentSubmissionForm({ requestId, kind, submitting, onSubmit }) {
  const isDeposit = kind === "deposit";
  const [method, setMethod] = useState(isDeposit ? "gcash" : "cash");
  const [receipt, setReceipt] = useState(null);
  const needsReceipt = method !== "cash";
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(requestId, method, receipt); }} className="mt-5 rounded-xl border border-line bg-[#f7f4ed] p-4">
      <h3 className="font-black text-ink">{isDeposit ? "Submit required deposit" : "Record rental payment"}</h3>
      <p className="mt-1 text-sm leading-6 text-ink-muted">{isDeposit ? "Send the deposit using the owner’s details above, then upload your receipt for verification." : "Choose how you will pay. Cash can be confirmed by the owner when you meet; online payments require a receipt."}</p>
      <label className="mt-4 block text-sm font-bold text-ink">Payment method</label>
      <select value={method} onChange={(event) => { setMethod(event.target.value); setReceipt(null); }} className="input mt-2" required>
        {!isDeposit && <option value="cash">Cash</option>}
        <option value="gcash">GCash</option>
        <option value="bank">Bank transfer</option>
      </select>
      {needsReceipt && <label className="mt-4 block text-sm font-bold text-ink">Payment receipt
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-line bg-white p-3 text-sm" required />
      </label>}
      <button type="submit" disabled={submitting || (needsReceipt && !receipt)} className="button-primary mt-4 min-h-11 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Submitting…" : isDeposit ? "Submit deposit for verification" : "Record payment"}</button>
    </form>
  );
}

function PaymentRecord({ title, method, submittedAt, confirmedAt, proofUrl }) {
  if (!submittedAt) return null;
  return <section className="mt-5 rounded-xl border border-brand/20 bg-brand-soft/45 p-4">
    <h3 className="font-black text-ink">{title}</h3>
    <p className="mt-2 text-sm text-ink-muted"><strong className="capitalize text-ink">{method === "bank" ? "Bank transfer" : method}</strong> · {confirmedAt ? "Confirmed by owner" : "Waiting for owner confirmation"}</p>
    {proofUrl && <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex font-bold text-brand-strong hover:underline">View payment receipt →</a>}
  </section>;
}

function RequestCard({ request, role, renterProfile, paymentMethods, busyId, ownReview, onDecision, onCancel, onLifecycle, onSubmitDeposit, onSubmitPayment, onConfirmPayment, onReview }) {
  const isOwner = role === "owner";
  const lifecycleAction = lifecycleActions[role]?.[request.status];
  const isBusy = busyId === request.id;

  return (
    <article className="panel min-w-0 p-5 transition-[border-color,box-shadow] hover:border-brand/20 hover:shadow-[0_22px_55px_rgba(18,38,63,0.09)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-brand">{formatDate(request.start_date)} – {formatDate(request.end_date)}</p>
          <h2 className="mt-1 text-xl font-black text-ink">{request.listing_title}</h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-black ${statusClass[request.status] ?? statusClass.pending}`}>{statusLabel(request.status)}</span>
      </div>

      <dl className="mt-5 grid gap-3 border-y border-line py-4 text-sm sm:grid-cols-3">
        <div><dt className="text-ink-muted">Duration</dt><dd className="mt-1 font-bold text-ink">{request.duration_days} {request.duration_days === 1 ? "day" : "days"}</dd></div>
        <div><dt className="text-ink-muted">Rental total</dt><dd className="mt-1 font-bold text-ink">{formatPrice(request.rental_total)}</dd></div>
        <div><dt className="text-ink-muted">Replacement value</dt><dd className="mt-1 font-bold text-ink">{formatPrice(request.replacement_value)}</dd></div>
      </dl>

      {isOwner && (
        <section className="mt-5 rounded-xl border border-line bg-[#f7f4ed] p-4" aria-label="Renter trust information">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-ink">Renter</h3>
          <Link to={`/profiles/${request.renter_id}`} className="mt-3 flex w-fit items-center gap-3 rounded-xl p-1 pr-3 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label={`View ${renterProfile?.display_name || request.renter_name}'s public profile`}>
            <ProfileAvatar name={renterProfile?.display_name || request.renter_name} path={renterProfile?.avatar_path} round className="h-12 w-12 text-sm" />
            <span className="min-w-0">
              <span className="block font-black text-ink">{renterProfile?.display_name || request.renter_name}</span>
              <span className="mt-0.5 block text-sm font-bold text-brand-strong">View public profile →</span>
            </span>
          </Link>
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-sm text-ink-muted">
              {request.renter_account_type === "sme" ? `SME${request.renter_business_name ? ` · ${request.renter_business_name}` : ""}` : "Individual"}
              <span className="mx-2" aria-hidden="true">·</span>{request.renter_is_verified ? "Verified account" : "Account not verified"}
            </p>
            <p className="mt-1 text-sm text-ink-muted">Account age at request: {request.renter_account_age_days} days</p>
          </div>
        </section>
      )}

      {!isOwner && (["accepted", "handed_over", "returned"].includes(request.status) || (request.status === "pending" && Number(request.required_deposit) > 0)) && <PaymentDetails methods={paymentMethods} />}
      {request.status === "pending" && Number(request.required_deposit) > 0 && <PaymentRecord title={`Required deposit · ${formatPrice(request.required_deposit)}`} method={request.deposit_payment_method} submittedAt={request.deposit_submitted_at} confirmedAt={request.deposit_verified_at} proofUrl={request.deposit_proof_url} />}
      {isOwner && request.status === "pending" && Number(request.required_deposit) > 0 && !request.deposit_submitted_at && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Waiting for the renter to submit the required deposit.</p>}
      {!isOwner && request.status === "pending" && Number(request.required_deposit) > 0 && !request.deposit_submitted_at && <PaymentSubmissionForm requestId={request.id} kind="deposit" submitting={isBusy} onSubmit={onSubmitDeposit} />}
      {["handed_over", "returned", "completed"].includes(request.status) && <PaymentRecord title={`Rental payment · ${formatPrice(request.rental_total)}`} method={request.rental_payment_method} submittedAt={request.rental_payment_submitted_at} confirmedAt={request.rental_payment_confirmed_at} proofUrl={request.rental_payment_proof_url} />}
      {!isOwner && ["handed_over", "returned"].includes(request.status) && !request.rental_payment_submitted_at && <PaymentSubmissionForm requestId={request.id} kind="rental" submitting={isBusy} onSubmit={onSubmitPayment} />}

      <details className="group mt-5 rounded-xl border border-line bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-ink marker:content-none">
          <span>Risk and request details</span>
          <span className="text-xl text-brand transition-transform group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <div className="border-t border-line px-4 pb-4"><RiskSummary request={request} compact /></div>
      </details>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link to={`/listings/${request.listing_id}`} className="font-bold text-brand-strong hover:underline">View listing</Link>
        {isOwner && request.status === "pending" && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => onDecision(request.id, "rejected")} disabled={isBusy} className="min-h-11 rounded-xl border border-red-200 px-4 font-bold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">Reject</button>
            <button type="button" onClick={() => onDecision(request.id, "accepted")} disabled={isBusy || (Number(request.required_deposit) > 0 && !request.deposit_submitted_at)} className="button-primary min-h-11 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60">{isBusy ? "Saving…" : Number(request.required_deposit) > 0 ? "Verify deposit & accept" : "Accept"}</button>
          </div>
        )}
        {!isOwner && request.status === "pending" && (
          <button type="button" onClick={() => onCancel(request.id)} disabled={isBusy} className="min-h-11 rounded-xl border border-red-200 px-4 font-bold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">{isBusy ? "Cancellingâ€¦" : "Cancel request"}</button>
        )}
        {lifecycleAction && !(isOwner && request.status === "returned" && !request.rental_payment_confirmed_at) && (
          <button type="button" onClick={() => onLifecycle(request.id, lifecycleAction)} disabled={isBusy} className="button-primary min-h-11 px-4 py-2">{isBusy ? "Saving…" : lifecycleAction.label}</button>
        )}
        {isOwner && request.status === "returned" && !request.rental_payment_confirmed_at && <span className="text-sm font-bold text-ink-muted">Confirm payment before completing</span>}
        {isOwner && ["handed_over", "returned"].includes(request.status) && request.rental_payment_submitted_at && !request.rental_payment_confirmed_at && (
          <button type="button" onClick={() => onConfirmPayment(request.id)} disabled={isBusy} className="button-primary min-h-11 px-4 py-2">{isBusy ? "Saving…" : request.rental_payment_method === "cash" ? "Confirm cash received" : "Confirm payment"}</button>
        )}
      </div>

      {request.status === "completed" && ownReview && (
        <div className="mt-5 rounded-xl border border-brand/20 bg-brand-soft p-4">
          <p className="text-sm font-black text-ink">Your review</p>
          <div className="mt-1"><StarRating rating={ownReview.rating} /></div>
          {ownReview.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{ownReview.comment}</p>}
        </div>
      )}
      {request.status === "completed" && !ownReview && <ReviewForm requestId={request.id} submitting={isBusy} onSubmit={onReview} />}
    </article>
  );
}

function RequestSection({ title, description, requests, emptyMessage, role, renterProfiles, paymentMethods, busyId, reviews, onDecision, onCancel, onLifecycle, onSubmitDeposit, onSubmitPayment, onConfirmPayment, onReview }) {
  return (
    <section>
      {title && <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-ink">{title}</h2>}
      {description && <p className="mt-2 text-base leading-7 text-ink-muted">{description}</p>}
      {requests.length === 0 ? (
        <div className="empty-state mt-5">{emptyMessage}</div>
      ) : (
        <div className="mt-5 space-y-5">
          {requests.map((request) => {
            const ownReview = reviews.find((review) => review.rental_request_id === request.id && review.reviewer_role === role);
            return <RequestCard key={request.id} request={request} role={role} renterProfile={renterProfiles[request.renter_id]} paymentMethods={paymentMethods[request.owner_id]} busyId={busyId} ownReview={ownReview} onDecision={onDecision} onCancel={onCancel} onLifecycle={onLifecycle} onSubmitDeposit={onSubmitDeposit} onSubmitPayment={onSubmitPayment} onConfirmPayment={onConfirmPayment} onReview={onReview} />;
          })}
        </div>
      )}
    </section>
  );
}

export default function RentalRequests() {
  const { user, isConfigured } = useAuth();
  const location = useLocation();
  const [requests, setRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [renterProfiles, setRenterProfiles] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(location.state?.message ?? "");
  const [activeView, setActiveView] = useState("renting");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadRequests = useCallback(async () => {
    if (!isConfigured) {
      setError("Supabase is not configured for this environment.");
      setIsLoading(false);
      return;
    }
    setError("");
    setIsLoading(true);
    const [requestsResult, reviewsResult] = await Promise.all([
      supabase.from("rental_requests").select(rentalRequestColumns).order("created_at", { ascending: false }),
      supabase.from("rental_reviews").select("id, rental_request_id, reviewer_role, rating, comment, created_at").order("created_at", { ascending: false }),
    ]);
    if (requestsResult.error) setError(requestsResult.error.message);
    else if (reviewsResult.error) setError(reviewsResult.error.message);
    else {
      const loadedRequests = requestsResult.data ?? [];
      const requestsWithReceipts = await Promise.all(loadedRequests.map(async (request) => {
        const enriched = { ...request };
        if (request.deposit_proof_path) {
          const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(request.deposit_proof_path, 1800);
          enriched.deposit_proof_url = data?.signedUrl ?? "";
        }
        if (request.rental_payment_proof_path) {
          const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(request.rental_payment_proof_path, 1800);
          enriched.rental_payment_proof_url = data?.signedUrl ?? "";
        }
        return enriched;
      }));
      setRequests(requestsWithReceipts);
      setReviews(reviewsResult.data ?? []);
      const renterIds = [...new Set(loadedRequests.filter((request) => request.owner_id === user.id).map((request) => request.renter_id))];
      const publicProfiles = await Promise.all(renterIds.map(async (renterId) => {
        const { data } = await supabase.rpc("get_public_profile", { p_profile_id: renterId }).maybeSingle();
        return data ? [renterId, data] : null;
      }));
      setRenterProfiles(Object.fromEntries(publicProfiles.filter(Boolean)));

      const payableOwnerIds = [...new Set(loadedRequests.filter((request) => request.renter_id === user.id && ["pending", "accepted", "handed_over", "returned"].includes(request.status)).map((request) => request.owner_id))];
      if (payableOwnerIds.length) {
        const { data: loadedMethods } = await supabase.from("payment_methods").select("id, owner_id, method, account_name, account_reference, qr_path").eq("is_enabled", true).in("owner_id", payableOwnerIds);
        const methodsWithUrls = await Promise.all((loadedMethods ?? []).map(async (method) => {
          if (!method.qr_path) return method;
          const { data: signed } = await supabase.storage.from("payment-qr-codes").createSignedUrl(method.qr_path, 1800);
          return { ...method, qr_url: signed?.signedUrl ?? "" };
        }));
        setPaymentMethods(methodsWithUrls.reduce((result, method) => ({ ...result, [method.owner_id]: [...(result[method.owner_id] ?? []), method] }), {}));
      } else setPaymentMethods({});
    }
    setIsLoading(false);
  }, [isConfigured, user.id]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function runRequestAction(requestId, rpc, parameters, successMessage) {
    setError(""); setMessage(""); setBusyId(requestId);
    const { error: actionError } = await supabase.rpc(rpc, parameters);
    setBusyId("");
    if (actionError) { setError(actionError.message); return; }
    setMessage(successMessage);
    await loadRequests();
  }

  const decideRequest = (requestId, decision) => runRequestAction(requestId, "decide_rental_request", { p_request_id: requestId, p_decision: decision }, `Request ${decision}.`);
  const cancelRequest = (requestId) => {
    if (!window.confirm("Cancel this rental request? This cannot be undone.")) return;
    runRequestAction(requestId, "cancel_rental_request", { p_request_id: requestId }, "Your rental request was cancelled.");
  };
  async function uploadReceipt(requestId, kind, file) {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) throw new Error("Payment receipts must be 5 MB or smaller.");
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) throw new Error("Use a JPG, PNG, WebP, or PDF receipt.");
    const extension = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
    const path = `${user.id}/${requestId}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    return path;
  }
  async function submitDeposit(requestId, method, receipt) {
    setError(""); setMessage(""); setBusyId(requestId);
    try {
      const proofPath = await uploadReceipt(requestId, "deposit", receipt);
      await runRequestAction(requestId, "submit_rental_deposit", { p_request_id: requestId, p_method: method, p_proof_path: proofPath }, "Deposit submitted. The owner can now verify it and accept your request.");
    } catch (submissionError) { setBusyId(""); setError(submissionError.message); }
  }
  async function submitRentalPayment(requestId, method, receipt) {
    setError(""); setMessage(""); setBusyId(requestId);
    try {
      const proofPath = method === "cash" ? null : await uploadReceipt(requestId, "rental", receipt);
      await runRequestAction(requestId, "submit_rental_payment", { p_request_id: requestId, p_method: method, p_proof_path: proofPath }, method === "cash" ? "Cash payment recorded. The owner can confirm it when received." : "Payment submitted for owner confirmation.");
    } catch (submissionError) { setBusyId(""); setError(submissionError.message); }
  }
  const confirmPayment = (requestId) => runRequestAction(requestId, "confirm_rental_payment", { p_request_id: requestId }, "Rental payment confirmed.");
  const advanceRequest = (requestId, lifecycleAction) => runRequestAction(requestId, "advance_rental_request", { p_request_id: requestId, p_action: lifecycleAction.action }, lifecycleAction.success);
  const submitReview = (requestId, rating, comment) => runRequestAction(requestId, "submit_rental_review", { p_request_id: requestId, p_rating: rating, p_comment: comment.trim() || null }, "Your review is now visible on the member’s public profile.");

  const renting = requests.filter((request) => request.renter_id === user.id);
  const ownerQueue = requests.filter((request) => request.owner_id === user.id);
  const activeRequests = activeView === "renting" ? renting : ownerQueue;
  const visibleRequests = statusFilter === "all" ? activeRequests : activeRequests.filter((request) => request.status === statusFilter);
  const requestCounts = useMemo(() => activeRequests.reduce((counts, request) => {
    counts[request.status] = (counts[request.status] ?? 0) + 1;
    return counts;
  }, {}), [activeRequests]);
  const activeCount = (requestCounts.accepted ?? 0) + (requestCounts.handed_over ?? 0) + (requestCounts.returned ?? 0);
  const sectionCopy = activeView === "renting" ? {
    title: "Your rental requests",
    description: "Submit deposits, record payment, and track each rental from approval through return.",
    empty: statusFilter === "all" ? "You have not requested a rental yet." : "No rental requests match this status.",
    role: "renter",
  } : {
    title: "Owner rental queue",
    description: "Verify deposits, approve renters, confirm payments, and complete returns.",
    empty: statusFilter === "all" ? "There are no requests on your listings." : "No owner requests match this status.",
    role: "owner",
  };

  return (
    <div className="w-full self-start">
      <div>
        <p className="eyebrow">Rental decisions</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink sm:text-5xl">Requests</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">Review risk decisions, progress accepted rentals, and leave reputation feedback after completion.</p>
      </div>
      {message && <p className="mt-6 rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm text-brand-strong" role="status">{message}</p>}
      {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
      {isLoading ? (
        <div className="mt-8 space-y-4" role="status" aria-label="Loading rental requests">{[0, 1].map((item) => <div key={item} className="h-48 animate-pulse rounded-[1.5rem] border border-line bg-surface" />)}</div>
      ) : (
        <div className="mt-8">
          <div className="rounded-2xl border border-line bg-white p-3 shadow-sm sm:p-4">
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Request type">
              <button type="button" role="tab" aria-selected={activeView === "renting"} onClick={() => { setActiveView("renting"); setStatusFilter("all"); }} className={`min-h-12 rounded-xl px-3 text-sm font-black transition sm:text-base ${activeView === "renting" ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:bg-[#f7f4ed]"}`}>Renting <span className="ml-1 opacity-80">{renting.length}</span></button>
              <button type="button" role="tab" aria-selected={activeView === "owner"} onClick={() => { setActiveView("owner"); setStatusFilter("all"); }} className={`min-h-12 rounded-xl px-3 text-sm font-black transition sm:text-base ${activeView === "owner" ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:bg-[#f7f4ed]"}`}>My listings <span className="ml-1 opacity-80">{ownerQueue.length}</span></button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-ink-soft">All</p><p className="mt-1 text-2xl font-black text-ink">{activeRequests.length}</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending</p><p className="mt-1 text-2xl font-black text-ink">{requestCounts.pending ?? 0}</p></div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-800">Active</p><p className="mt-1 text-2xl font-black text-ink">{activeCount}</p></div>
            <div className="rounded-xl border border-brand/20 bg-brand-soft p-4"><p className="text-xs font-bold uppercase tracking-wider text-brand-strong">Completed</p><p className="mt-1 text-2xl font-black text-ink">{requestCounts.completed ?? 0}</p></div>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-ink">{sectionCopy.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{sectionCopy.description}</p></div>
            <label className="text-sm font-bold text-ink-muted">Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-ink sm:w-48">
                <option value="all">All statuses</option>
                {Object.keys(statusClass).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
            </label>
          </div>

          <div className="mx-auto mt-6 max-w-5xl">
            <RequestSection title="" description="" requests={visibleRequests} emptyMessage={sectionCopy.empty} role={sectionCopy.role} renterProfiles={renterProfiles} paymentMethods={paymentMethods} busyId={busyId} reviews={reviews} onDecision={decideRequest} onCancel={cancelRequest} onLifecycle={advanceRequest} onSubmitDeposit={submitDeposit} onSubmitPayment={submitRentalPayment} onConfirmPayment={confirmPayment} onReview={submitReview} />
          </div>
        </div>
      )}
    </div>
  );
}
