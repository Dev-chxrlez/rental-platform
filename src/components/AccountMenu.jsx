import { useState } from "react";
import { Link } from "react-router-dom";
import { accountTypeLabel } from "../lib/profiles";
import ProfileAvatar from "./ProfileAvatar";

function displayNameFor(user, profile) {
  if (profile?.account_type === "sme") return profile.business_name || profile.full_name;
  return profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Rental Platform member";
}

export default function AccountMenu({ user, profile, open, onToggle, onClose, buttonRef, buttonId, menuId, signOut }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const displayName = displayNameFor(user, profile);
  const accountType = profile?.account_type || user?.user_metadata?.account_type || "individual";

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);
    const { error: signOutError } = await signOut();
    if (signOutError) {
      setError(signOutError.message);
      setIsSigningOut(false);
      return;
    }
    onClose();
  }

  return (
    <div className="relative" data-nav-popover>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        onClick={onToggle}
        className="nav-icon-button p-0.5"
        aria-label="Open account menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <ProfileAvatar name={displayName} path={profile?.avatar_path} round className="h-9 w-9 text-xs" />
      </button>

      {open && (
        <div
          id={menuId}
          className="dropdown-surface fixed left-4 right-4 top-[4.25rem] z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.65rem)] sm:w-80"
          aria-labelledby={buttonId}
        >
          <div className="border-b border-line bg-[#f7f4ed] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <ProfileAvatar name={displayName} path={profile?.avatar_path} round className="h-11 w-11 text-sm" />
              <div className="min-w-0">
                <p className="truncate font-black text-ink">{displayName}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{accountTypeLabel(accountType)} account</p>
              </div>
            </div>
          </div>
          <nav className="p-2" aria-label="Account options">
            {profile?.is_admin && <Link to="/admin" onClick={onClose} className="dropdown-link">Admin dashboard</Link>}
            {profile?.is_admin && <Link to="/admin/listings" onClick={onClose} className="dropdown-link">Review listings</Link>}
            {!profile?.is_admin && <Link to={`/profiles/${user.id}`} onClick={onClose} className="dropdown-link">View profile</Link>}
            {!profile?.is_admin && <Link to="/profile" onClick={onClose} className="dropdown-link">Account settings</Link>}
            {!profile?.is_admin && <Link to="/payment-settings" onClick={onClose} className="dropdown-link">Payment details</Link>}
            <button type="button" onClick={handleSignOut} disabled={isSigningOut} className="dropdown-link w-full text-left disabled:cursor-wait disabled:opacity-60">
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </nav>
          {error && <p className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">Sign out failed: {error}</p>}
        </div>
      )}
    </div>
  );
}
