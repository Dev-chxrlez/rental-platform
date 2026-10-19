import { useEffect, useId, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AccountMenu from "./components/AccountMenu";
import AdminShell from "./components/AdminShell";
import BrandMark from "./components/BrandMark";
import NotificationMenu from "./components/NotificationMenu";
import AdminDashboard from "./pages/AdminDashboard";
import AdminListingReview from "./pages/AdminListingReview";
import AdminRentalRequests from "./pages/AdminRentalRequests";
import BrowseListings from "./pages/BrowseListings";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import ListingDetails from "./pages/ListingDetails";
import ListingEditor from "./pages/ListingEditor";
import MyListings from "./pages/MyListings";
import PaymentSettings from "./pages/PaymentSettings";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import RentalRequests from "./pages/RentalRequests";
import RequestRental from "./pages/RequestRental";
import SignIn from "./pages/SignIn";

const publicLinks = [
  { to: "/", label: "Home" },
  { to: "/listings", label: "Browse listings" },
];

function navLinkClass({ isActive }) {
  return [
    "relative flex min-h-11 items-center rounded-xl px-3 py-2 text-[0.95rem] font-bold transition-[color,background-color]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    isActive
      ? "bg-brand-soft text-brand-strong shadow-[inset_0_-2px_0_rgba(15,118,110,0.45)]"
      : "text-ink-muted hover:bg-white hover:text-ink",
  ].join(" ");
}

function MemberRoute({ children }) {
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const location = useLocation();
  if (isLoading || (user && isProfileLoading)) return <p className="m-auto text-base text-ink-muted" role="status">Checking account access…</p>;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location }} />;
  if (profile?.is_admin) return <Navigate to="/admin" replace />;
  return children;
}

function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("");
  const mobileMenuId = useId();
  const notificationMenuId = useId();
  const profileMenuId = useId();
  const notificationButtonId = useId();
  const profileButtonId = useId();
  const notificationButtonRef = useRef(null);
  const profileButtonRef = useRef(null);
  const mobileButtonRef = useRef(null);
  const location = useLocation();
  const { user, profile, isLoading, signOut } = useAuth();
  const accountLinks = user
    ? profile?.is_admin
      ? [{ to: "/admin", label: "Admin dashboard" }]
      : [
        { to: "/requests", label: "Requests" },
        { to: "/my-listings", label: "My listings" },
      ]
    : [
        { to: "/sign-in", label: "Sign in" },
        { to: "/register", label: "Create account" },
      ];
  const links = [...publicLinks, ...accountLinks];

  useEffect(() => {
    setIsOpen(false);
    setActiveMenu("");
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (activeMenu) {
        const returnFocus = activeMenu === "notifications" ? notificationButtonRef : profileButtonRef;
        setActiveMenu("");
        returnFocus.current?.focus();
      } else if (isOpen) {
        setIsOpen(false);
        mobileButtonRef.current?.focus();
      }
    }

    function closeOnOutsidePointer(event) {
      if (activeMenu && !event.target.closest("[data-nav-popover]")) setActiveMenu("");
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [activeMenu, isOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center gap-2 px-3 min-[380px]:px-4 sm:px-6 lg:px-8">
        <NavLink
          to="/"
          className="mr-auto shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          aria-label="Rental Platform home"
        >
          <span className="lg:hidden"><BrandMark compact={Boolean(user)} /></span>
          <span className="hidden lg:inline-flex"><BrandMark /></span>
        </NavLink>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} className={navLinkClass}>{link.label}</NavLink>
          ))}
          {isLoading && <span className="px-3 py-2 text-sm text-ink-soft">Checking session…</span>}
        </nav>

        {user && (
          <div className="flex shrink-0 items-center gap-1.5 lg:ml-2 lg:border-l lg:border-line lg:pl-3">
            <NotificationMenu
              userId={user.id}
              open={activeMenu === "notifications"}
              onToggle={() => { setIsOpen(false); setActiveMenu((current) => current === "notifications" ? "" : "notifications"); }}
              onClose={() => setActiveMenu("")}
              buttonRef={notificationButtonRef}
              buttonId={notificationButtonId}
              menuId={notificationMenuId}
            />
            <AccountMenu
              user={user}
              profile={profile}
              open={activeMenu === "profile"}
              onToggle={() => { setIsOpen(false); setActiveMenu((current) => current === "profile" ? "" : "profile"); }}
              onClose={() => setActiveMenu("")}
              buttonRef={profileButtonRef}
              buttonId={profileButtonId}
              menuId={profileMenuId}
              signOut={signOut}
            />
          </div>
        )}

        <button
          ref={mobileButtonRef}
          type="button"
          className="nav-icon-button relative lg:hidden"
          aria-controls={mobileMenuId}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => { setActiveMenu(""); setIsOpen((open) => !open); }}
        >
          <span aria-hidden="true" className="grid gap-1.5">
            <span className={`block h-0.5 w-5 rounded bg-current transition-transform ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 rounded bg-current transition-opacity ${isOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 rounded bg-current transition-transform ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      <nav
        id={mobileMenuId}
        className={`${isOpen ? "block" : "hidden"} border-t border-line bg-canvas px-3 py-3 shadow-[0_16px_30px_rgba(18,38,63,0.08)] min-[380px]:px-4 lg:hidden`}
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} className={navLinkClass}>{link.label}</NavLink>
          ))}
          {isLoading && <span className="px-3 py-2 text-sm text-ink-soft">Checking session…</span>}
        </div>
      </nav>
    </header>
  );
}

const footerGroups = [
  {
    title: "Marketplace",
    links: [
      { to: "/listings", label: "Browse listings" },
      { to: "/listings/new", label: "List an item" },
      { to: "/requests", label: "Rental requests" },
    ],
  },
  {
    title: "Your account",
    links: [
      { to: "/profile", label: "Profile" },
      { to: "/my-listings", label: "My listings" },
      { to: "/sign-in", label: "Sign in" },
    ],
  },
  {
    title: "Get started",
    links: [
      { to: "/", label: "How it works" },
      { to: "/register", label: "Create account" },
      { to: "/listings", label: "Find equipment" },
    ],
  },
];

function FooterIconLink({ to, label, children }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-ink-muted shadow-sm transition-[color,border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-brand/50 hover:text-brand-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </NavLink>
  );
}

function Footer() {
  return (
    <footer className="px-3 pb-3 pt-8 min-[380px]:px-4 sm:px-6 sm:pb-6 lg:px-8 lg:pt-12">
      <div className="mx-auto max-w-7xl rounded-[1.5rem] border border-line/90 bg-surface px-5 py-7 shadow-[0_18px_50px_rgba(18,38,63,0.09)] sm:px-7 sm:py-8 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[minmax(15rem,1.35fr)_2fr] lg:gap-16">
          <div>
            <NavLink
              to="/"
              aria-label="Rental Platform home"
              className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <BrandMark />
            </NavLink>
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink-muted">
              A straightforward place for individuals and growing businesses to list, discover, and rent useful equipment.
            </p>
            <div className="mt-5 flex gap-2" aria-label="Quick links">
              <FooterIconLink to="/listings" label="Browse listings">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                  <path d="m3.5 10.5 8.5-7 8.5 7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </FooterIconLink>
              <FooterIconLink to="/listings/new" label="Create a listing">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </FooterIconLink>
              <FooterIconLink to="/profile" label="Open your profile">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" strokeLinecap="round" />
                </svg>
              </FooterIconLink>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3" aria-label="Footer navigation">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-black text-ink">{group.title}</h2>
                <ul className="mt-3 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <NavLink
                        to={link.to}
                        className="rounded-md text-sm text-ink-muted transition-colors hover:text-brand-strong hover:underline hover:decoration-brand/40 hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-5 text-xs leading-5 text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Rental Platform. All rights reserved.</p>
          <p className="sm:text-right">Built for safer, simpler community rentals.</p>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const location = useLocation();
  const isAdminArea = location.pathname === "/admin" || location.pathname.startsWith("/admin/");

  if (isAdminArea) {
    return (
      <Routes>
        <Route path="/admin" element={<ProtectedRoute><AdminShell /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="listings" element={<AdminListingReview />} />
          <Route path="requests" element={<AdminRentalRequests />} />
        </Route>
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listings" element={<BrowseListings />} />
          <Route path="/listings/:id" element={<ListingDetails />} />
          <Route path="/profiles/:id" element={<PublicProfile />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<MemberRoute><Profile /></MemberRoute>} />
          <Route path="/my-listings" element={<MemberRoute><MyListings /></MemberRoute>} />
          <Route path="/payment-settings" element={<MemberRoute><PaymentSettings /></MemberRoute>} />
          <Route path="/listings/new" element={<MemberRoute><ListingEditor /></MemberRoute>} />
          <Route path="/listings/:id/edit" element={<MemberRoute><ListingEditor /></MemberRoute>} />
          <Route path="/listings/:id/request" element={<MemberRoute><RequestRental /></MemberRoute>} />
          <Route path="/requests" element={<MemberRoute><RentalRequests /></MemberRoute>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
