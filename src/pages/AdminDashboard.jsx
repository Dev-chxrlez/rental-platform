import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { labelFor, LISTING_CATEGORIES, MODERATION_LABELS } from "../lib/listings";
import { supabase } from "../lib/supabase";

const numberFormatter = new Intl.NumberFormat("en-PH");

function MetricCard({ label, value, detail, icon, accent = false }) {
  const paths = {
    members: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.6-4 3-6 7-6s6.4 2 7 6" /></>,
    listings: <><path d="M4 4h16v16H4zM4 9h16M9 9v11" /></>,
    review: <><path d="M9 11l2 2 4-5" /><path d="M5 3h14v18H5z" /></>,
    requests: <><path d="M6 3h12v4H6zM4 5v16h16V5M8 12h8M8 16h5" /></>,
  };
  return (
    <article className={`rounded-2xl border p-5 shadow-[0_8px_30px_rgba(18,38,63,0.05)] ${accent ? "border-brand/20 bg-brand text-white" : "border-[#dde3e8] bg-white"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className={`text-sm font-bold ${accent ? "text-white/75" : "text-ink-muted"}`}>{label}</p><p className={`mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl ${accent ? "text-white" : "text-ink"}`}>{numberFormatter.format(value ?? 0)}</p></div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${accent ? "bg-white/15 text-white" : "bg-brand-soft text-brand-strong"}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[icon]}</svg></span>
      </div>
      <p className={`mt-4 text-xs leading-5 ${accent ? "text-white/70" : "text-ink-soft"}`}>{detail}</p>
    </article>
  );
}

function ActivityChart({ data }) {
  const width = 720, height = 260, left = 38, right = 16, top = 18, bottom = 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maxValue = Math.max(4, ...data.flatMap((item) => [item.listings, item.members, item.requests]));
  const ticks = [0, Math.ceil(maxValue / 2), maxValue];
  const x = (index) => left + (index * plotWidth) / Math.max(data.length - 1, 1);
  const y = (value) => top + plotHeight - (value / maxValue) * plotHeight;
  const pathFor = (key) => data.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(item[key]).toFixed(1)}`).join(" ");
  const shownDates = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  return (
    <div className="mt-5 w-full min-w-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby="activity-title activity-desc">
        <title id="activity-title">Platform activity over the last fourteen days</title><desc id="activity-desc">Daily totals for new listings, members, and rental requests.</desc>
        {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#dfe5e9" /><text x={left - 8} y={y(tick) + 4} textAnchor="end" fill="#7a8797" fontSize="11">{tick}</text></g>)}
        {data.map((item, index) => shownDates.has(index) && <text key={item.date} x={x(index)} y={height - 12} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} fill="#7a8797" fontSize="11">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(item.date))}</text>)}
        <path d={pathFor("listings")} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <path d={pathFor("requests")} fill="none" stroke="#d99a2b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <path d={pathFor("members")} fill="none" stroke="#60758d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((item, index) => <g key={`${item.date}-points`}><circle cx={x(index)} cy={y(item.listings)} r="3.5" fill="#0f766e"><title>{item.listings} listings</title></circle><circle cx={x(index)} cy={y(item.requests)} r="3.5" fill="#d99a2b"><title>{item.requests} requests</title></circle><circle cx={x(index)} cy={y(item.members)} r="3.5" fill="#60758d"><title>{item.members} members</title></circle></g>)}
      </svg>
    </div>
  );
}

function ModerationChart({ listings }) {
  const values = [{ label: "Approved", value: listings.approved ?? 0, color: "#0f766e" }, { label: "Pending", value: listings.pending ?? 0, color: "#d99a2b" }, { label: "Changes requested", value: listings.rejected ?? 0, color: "#c85a54" }];
  const total = Math.max(values.reduce((sum, item) => sum + item.value, 0), 1);
  let offset = 0;
  return <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
    <div className="relative h-40 w-40 shrink-0"><svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label="Listing moderation status breakdown"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#e8ecef" strokeWidth="6" />{values.map((item) => { const portion = (item.value / total) * 100, currentOffset = offset; offset += portion; return <circle key={item.label} cx="21" cy="21" r="15.9" fill="none" stroke={item.color} strokeWidth="6" strokeDasharray={`${portion} ${100 - portion}`} strokeDashoffset={-currentOffset} />; })}</svg><div className="absolute inset-0 grid place-content-center text-center"><span className="text-3xl font-black text-ink">{listings.total ?? 0}</span><span className="text-xs text-ink-soft">total</span></div></div>
    <div className="w-full space-y-3">{values.map((item) => <div key={item.label} className="flex items-center justify-between gap-5 text-sm"><span className="flex items-center gap-2 text-ink-muted"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span><span className="font-black text-ink">{item.value}</span></div>)}</div>
  </div>;
}

function CategoryBars({ categories }) {
  const max = Math.max(1, ...categories.map((item) => item.count));
  return <div className="mt-6 space-y-4">{categories.length === 0 ? <p className="py-10 text-center text-sm text-ink-soft">No approved listings yet.</p> : categories.map((item) => <div key={item.category}><div className="mb-1.5 flex items-center justify-between gap-4 text-sm"><span className="font-bold text-ink-muted">{labelFor(LISTING_CATEGORIES, item.category)}</span><span className="font-black text-ink">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e8ecef]"><div className="h-full rounded-full bg-brand" style={{ width: `${(item.count / max) * 100}%` }} /></div></div>)}</div>;
}

function statusClass(status) { return status === "approved" ? "bg-brand-soft text-brand-strong" : status === "rejected" ? "bg-red-50 text-red-700" : "bg-accent-soft text-[#76500d]"; }

export default function AdminDashboard() {
  const { profile, isProfileLoading } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isProfileLoading) return;
    if (!profile?.is_admin) { setIsLoading(false); return; }
    let ignore = false;
    async function loadDashboard() { setIsLoading(true); const { data, error: loadError } = await supabase.rpc("get_admin_dashboard"); if (ignore) return; if (loadError) setError(loadError.message); else setDashboard(data); setIsLoading(false); }
    loadDashboard(); return () => { ignore = true; };
  }, [isProfileLoading, profile?.is_admin]);

  const attentionItems = useMemo(() => !dashboard ? [] : [dashboard.listings.pending > 0 && `${dashboard.listings.pending} listing${dashboard.listings.pending === 1 ? "" : "s"} awaiting review`, dashboard.requests.pending > 0 && `${dashboard.requests.pending} rental request${dashboard.requests.pending === 1 ? "" : "s"} awaiting owner action`, dashboard.listings.rejected > 0 && `${dashboard.listings.rejected} listing${dashboard.listings.rejected === 1 ? "" : "s"} waiting for owner changes`].filter(Boolean), [dashboard]);

  if (isProfileLoading || isLoading) return <div className="grid min-h-[60vh] place-items-center text-ink-muted" role="status">Loading administrator dashboard…</div>;
  if (!profile?.is_admin) return <section className="rounded-2xl border border-red-200 bg-white p-8"><h1 className="text-2xl font-black">Administrator access required</h1></section>;
  if (error) return <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-red-200 bg-white p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Setup required</p><h1 className="mt-3 text-2xl font-black text-ink">Connect the dashboard data</h1><p className="mt-3 break-words text-sm leading-6 text-red-800" role="alert">{error}</p><p className="mt-4 text-sm leading-6 text-ink-muted">Run migration <strong>20260924000900_add_admin_dashboard.sql</strong> in the Supabase SQL Editor, then refresh this page.</p></section>;

  return <section>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-sm font-bold text-brand">Overview</p><h1 className="mt-1 break-words text-2xl font-black tracking-[-0.035em] text-ink sm:text-3xl">Good day, {profile.full_name?.split(" ")[0] || "Admin"}</h1><p className="mt-2 text-sm text-ink-muted">Here’s what is happening across Rental Platform today.</p></div><p className="w-fit max-w-full rounded-xl border border-[#dde3e8] bg-white px-3 py-2 text-xs font-bold text-ink-muted shadow-sm sm:px-4 sm:text-sm">{new Intl.DateTimeFormat("en-PH", { dateStyle: "full" }).format(new Date())}</p></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total members" value={dashboard.users.total} detail={`${dashboard.users.individuals} individual · ${dashboard.users.businesses} SME`} icon="members" /><MetricCard label="Live listings" value={dashboard.listings.active} detail={`${dashboard.listings.total} submitted across all statuses`} icon="listings" /><MetricCard label="Awaiting review" value={dashboard.listings.pending} detail="Listings requiring an admin decision" icon="review" accent /><MetricCard label="Rental requests" value={dashboard.requests.total} detail={`${dashboard.requests.pending} pending · ${dashboard.requests.completed} completed`} icon="requests" /></div>
    {attentionItems.length > 0 && <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#efd8a4] bg-[#fff8e8] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><p className="font-black text-ink">Needs attention</p><p className="mt-1 break-words text-sm leading-6 text-ink-muted">{attentionItems.join(" · ")}</p></div>{dashboard.listings.pending > 0 && <Link to="/admin/listings" className="button-primary w-full shrink-0 sm:w-auto">Review queue</Link>}</div>}
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)]">
      <article className="rounded-2xl border border-[#dde3e8] bg-white p-5 shadow-[0_8px_30px_rgba(18,38,63,0.04)] sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-black text-ink">Platform activity</h2><p className="mt-1 text-sm text-ink-soft">New activity over the last 14 days</p></div><div className="flex flex-wrap gap-4 text-xs font-bold text-ink-muted"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-brand" />Listings</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-accent" />Requests</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#60758d]" />Members</span></div></div><ActivityChart data={dashboard.activity ?? []} /></article>
      <article className="rounded-2xl border border-[#dde3e8] bg-white p-5 shadow-[0_8px_30px_rgba(18,38,63,0.04)] sm:p-6"><h2 className="text-lg font-black text-ink">Listing moderation</h2><p className="mt-1 text-sm text-ink-soft">All submitted inventory</p><ModerationChart listings={dashboard.listings} /></article>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.65fr)]">
      <article className="rounded-2xl border border-[#dde3e8] bg-white p-5 shadow-[0_8px_30px_rgba(18,38,63,0.04)] sm:p-6"><h2 className="text-lg font-black text-ink">Live inventory</h2><p className="mt-1 text-sm text-ink-soft">Approved listings by category</p><CategoryBars categories={dashboard.categories ?? []} /></article>
      <article className="overflow-hidden rounded-2xl border border-[#dde3e8] bg-white shadow-[0_8px_30px_rgba(18,38,63,0.04)]"><div className="flex flex-col items-start gap-3 border-b border-[#e7ebee] px-4 py-5 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-6"><div className="min-w-0"><h2 className="text-lg font-black text-ink">Recent submissions</h2><p className="mt-1 text-sm text-ink-soft">Latest marketplace inventory</p></div><Link to="/admin/listings" className="shrink-0 text-sm font-bold text-brand-strong hover:underline">View queue</Link></div>{(dashboard.recent_listings ?? []).length === 0 ? <p className="px-5 py-12 text-center text-sm text-ink-soft">No listings submitted yet.</p> : <div className="divide-y divide-[#e7ebee]">{dashboard.recent_listings.map((listing) => <div key={listing.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><Link to={`/listings/${listing.id}`} className="block break-words font-black text-ink hover:text-brand-strong sm:truncate">{listing.title}</Link><p className="mt-1 break-words text-xs text-ink-soft">{listing.owner_name} · {new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(listing.created_at))}</p></div><span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${statusClass(listing.moderation_status)}`}>{MODERATION_LABELS[listing.moderation_status] ?? listing.moderation_status}</span></div>)}</div>}</article>
    </div>
  </section>;
}
