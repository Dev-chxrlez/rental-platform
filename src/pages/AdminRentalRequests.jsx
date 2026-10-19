import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatPrice } from "../lib/listings";
import { supabase } from "../lib/supabase";

const statusLabels = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
  handed_over: "Handed over",
  returned: "Returned",
  completed: "Completed",
};

function statusClass(status) {
  if (status === "completed") return "bg-brand-soft text-brand-strong";
  if (status === "rejected" || status === "cancelled") return "bg-red-50 text-red-700";
  if (status === "pending") return "bg-accent-soft text-[#76500d]";
  return "bg-[#e8edf2] text-ink-muted";
}

function riskClass(risk) {
  if (risk === "high") return "text-red-700";
  if (risk === "medium") return "text-[#94610b]";
  return "text-brand-strong";
}

export default function AdminRentalRequests() {
  const { profile, isProfileLoading } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isProfileLoading) return;
    if (!profile?.is_admin) { setIsLoading(false); return; }
    let ignore = false;
    async function loadRequests() {
      const { data, error: loadError } = await supabase.rpc("get_admin_rental_requests");
      if (ignore) return;
      if (loadError) setError(loadError.message);
      else setRequests(data ?? []);
      setIsLoading(false);
    }
    loadRequests();
    return () => { ignore = true; };
  }, [isProfileLoading, profile?.is_admin]);

  const counts = useMemo(() => requests.reduce((result, request) => {
    result[request.status] = (result[request.status] ?? 0) + 1;
    return result;
  }, {}), [requests]);
  const visibleRequests = filter === "all" ? requests : requests.filter((request) => request.status === filter);

  if (isProfileLoading || isLoading) return <div className="grid min-h-[60vh] place-items-center text-ink-muted" role="status">Loading rental requests…</div>;
  if (!profile?.is_admin) return <section className="rounded-2xl border border-red-200 bg-white p-8"><h1 className="text-2xl font-black">Administrator access required</h1></section>;
  if (error) return <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-red-200 bg-white p-7"><p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Setup required</p><h1 className="mt-3 text-2xl font-black">Rental oversight is unavailable</h1><p className="mt-3 text-sm leading-6 text-red-800" role="alert">{error}</p><p className="mt-4 text-sm text-ink-muted">Apply migration <strong>20260924001000_add_admin_rental_oversight.sql</strong>, then refresh.</p></section>;

  return (
    <section>
      <div>
        <p className="text-sm font-bold text-brand">Operations</p>
        <h1 className="mt-1 break-words text-2xl font-black tracking-[-0.035em] text-ink sm:text-3xl">Rental requests</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Monitor all rental activity. Administrators can inspect requests but cannot submit or decide rentals for users.</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#dde3e8] bg-white p-5"><p className="text-sm font-bold text-ink-muted">Total requests</p><p className="mt-2 text-3xl font-black text-ink">{requests.length}</p></div>
        <div className="rounded-2xl border border-[#efd8a4] bg-[#fff8e8] p-5"><p className="text-sm font-bold text-[#76500d]">Pending</p><p className="mt-2 text-3xl font-black text-ink">{counts.pending ?? 0}</p></div>
        <div className="rounded-2xl border border-[#cce5df] bg-brand-soft p-5"><p className="text-sm font-bold text-brand-strong">Completed</p><p className="mt-2 text-3xl font-black text-ink">{counts.completed ?? 0}</p></div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5"><p className="text-sm font-bold text-red-700">Rejected</p><p className="mt-2 text-3xl font-black text-ink">{counts.rejected ?? 0}</p></div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#dde3e8] bg-white shadow-[0_8px_30px_rgba(18,38,63,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#e7ebee] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h2 className="text-lg font-black text-ink">All requests</h2><p className="mt-1 text-sm text-ink-soft">Select a row to view its financial and risk details.</p></div>
          <label className="flex w-full flex-col gap-2 text-sm font-bold text-ink-muted sm:w-auto sm:flex-row sm:items-center">Status <select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink sm:w-auto"><option value="all">All</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        {visibleRequests.length === 0 ? <p className="px-5 py-14 text-center text-sm text-ink-soft">No rental requests match this filter.</p> : (
          <div className="divide-y divide-[#e7ebee]">
            {visibleRequests.map((request) => {
              const expanded = expandedId === request.id;
              return <article key={request.id}>
                <button type="button" onClick={() => setExpandedId(expanded ? "" : request.id)} aria-expanded={expanded} className="grid w-full gap-3 px-5 py-4 text-left hover:bg-[#f8fafb] sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0"><p className="break-words font-black text-ink sm:truncate">{request.listing_title}</p><p className="mt-1 break-words text-xs text-ink-soft">{request.renter_name} → {request.owner_name}</p></div>
                  <div><p className="text-sm font-bold text-ink">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(request.start_date))} – {new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(request.end_date))}</p><p className="mt-1 text-xs text-ink-soft">{request.duration_days} day{request.duration_days === 1 ? "" : "s"}</p></div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${statusClass(request.status)}`}>{statusLabels[request.status] ?? request.status}</span>
                </button>
                {expanded && <div className="grid gap-4 border-t border-[#edf0f2] bg-[#f8fafb] px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Rental total</p><p className="mt-1 font-black text-ink">{formatPrice(request.rental_total)}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Required deposit</p><p className="mt-1 font-black text-ink">{formatPrice(request.required_deposit)}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Risk assessment</p><p className={`mt-1 font-black capitalize ${riskClass(request.risk_band)}`}>{request.risk_band} · {request.risk_score}/100</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Submitted</p><p className="mt-1 font-black text-ink">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.created_at))}</p></div>
                  <div className="sm:col-span-2 lg:col-span-4"><Link to={`/listings/${request.listing_id}`} className="text-sm font-bold text-brand-strong hover:underline">View listing details →</Link></div>
                </div>}
              </article>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
