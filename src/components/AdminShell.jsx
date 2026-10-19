import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import BrandMark from "./BrandMark";
import ProfileAvatar from "./ProfileAvatar";

const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  review: <><path d="M9 11l2 2 4-5" /><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /></>,
  market: <><path d="M3 10h18M5 10v10h14V10M4 4h16l1 6H3l1-6Z" /><path d="M9 14h6" /></>,
  requests: <><path d="M7 3h10v4H7zM5 5H4a1 1 0 0 0-1 1v14h18V6a1 1 0 0 0-1-1h-1" /><path d="M7 12h10M7 16h7" /></>,
  logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></>,
};

function Icon({ name }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

function SidebarLink({ to, icon, children, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isActive ? "bg-white text-ink shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
    >
      <Icon name={icon} />
      {children}
    </NavLink>
  );
}

export default function AdminShell() {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  async function handleSignOut() {
    await signOut();
    navigate("/sign-in", { replace: true });
  }

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Administrator";

  return (
    <div className="flex min-h-screen w-full bg-[#f4f6f8] text-ink">
      {open && <button type="button" aria-label="Close admin menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-ink/45 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto bg-ink px-4 py-5 text-white shadow-2xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:max-w-none lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <BrandMark inverse />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close admin menu" className="grid h-10 w-10 place-items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white lg:hidden">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="mx-2 mt-6 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-brand-soft">Admin workspace</p>
          <p className="mt-1 truncate text-sm font-bold text-white">Platform operations</p>
        </div>

        <nav className="mt-6 flex-1 space-y-6 overflow-y-auto" aria-label="Administrator navigation">
          <div>
            <p className="px-3 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/35">Overview</p>
            <div className="mt-2 space-y-1">
              <SidebarLink to="/admin" icon="dashboard" end>Dashboard</SidebarLink>
            </div>
          </div>
          <div>
            <p className="px-3 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/35">Management</p>
            <div className="mt-2 space-y-1">
              <SidebarLink to="/admin/listings" icon="review">Listing approvals</SidebarLink>
              <SidebarLink to="/listings" icon="market">View marketplace</SidebarLink>
              <SidebarLink to="/admin/requests" icon="requests">Rental requests</SidebarLink>
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 pt-4">
          <button type="button" onClick={handleSignOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white">
            <Icon name="logout" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-[4.25rem] items-center justify-between border-b border-[#dde3e8] bg-white/95 px-3 backdrop-blur sm:min-h-[4.5rem] sm:px-6 lg:px-8">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" className="grid h-11 w-11 place-items-center rounded-xl border border-line text-ink-muted hover:bg-canvas lg:hidden">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-48 truncate text-sm font-black text-ink">{displayName}</p>
              <p className="text-xs text-ink-soft">Administrator</p>
            </div>
            <ProfileAvatar name={displayName} path={profile?.avatar_path} round className="h-10 w-10 text-xs" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[100rem] px-3 py-5 min-[380px]:px-4 sm:p-6 lg:p-8 xl:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
