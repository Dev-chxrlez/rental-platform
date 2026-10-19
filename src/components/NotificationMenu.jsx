import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m9-2v-4.25a6 6 0 0 0-12 0V15l-1.5 2h15L18 15Zm-4 5h-4" />
    </svg>
  );
}

function notificationTime(value) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationMenu({ userId, open, onToggle, onClose, buttonRef, buttonId, menuId }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  const loadNotifications = useCallback(async ({ quiet = false } = {}) => {
    if (!userId) return;
    if (!quiet) setIsLoading(true);
    const { data, error: loadError } = await supabase
      .from("notifications")
      .select("id, rental_request_id, type, title, message, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (loadError) setError(loadError.message);
    else {
      setNotifications(data ?? []);
      setError("");
    }
    if (!quiet) setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(() => loadNotifications({ quiet: true }), 30000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (open) loadNotifications({ quiet: true });
  }, [open, loadNotifications]);

  async function markRead(notificationId) {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification || notification.is_read) return;
    const { error: updateError } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, is_read: true } : item));
  }

  async function markAllRead() {
    const { error: updateError } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  }

  return (
    <div className="relative" data-nav-popover>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        onClick={onToggle}
        className="nav-icon-button relative"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={menuId}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.68rem] font-black leading-none text-ink ring-2 ring-canvas" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section id={menuId} className="dropdown-surface fixed left-4 right-4 top-[4.25rem] z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.65rem)] sm:w-[23rem]" aria-labelledby={buttonId}>
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="font-black text-ink">Notifications</h2>
              <p className="text-sm text-ink-muted">{unreadCount ? `${unreadCount} unread` : "You’re up to date"}</p>
            </div>
            {unreadCount > 0 && <button type="button" onClick={markAllRead} className="rounded-lg px-2 py-2 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Mark all read</button>}
          </div>

          <div className="max-h-[min(26rem,calc(100vh-8rem))] overflow-y-auto">
            {isLoading ? (
              <p className="p-5 text-sm text-ink-muted" role="status">Loading notifications…</p>
            ) : error ? (
              <div className="p-5" role="alert">
                <p className="font-bold text-ink">Notifications are unavailable.</p>
                <p className="mt-1 text-sm leading-6 text-red-700">{error}</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="font-bold text-ink">No notifications yet</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">New rental requests and owner decisions will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((notification) => (
                  <li key={notification.id} className={notification.is_read ? "bg-surface" : "bg-brand-soft/55"}>
                    <Link
                      to="/requests"
                      onClick={() => { markRead(notification.id); onClose(); }}
                      className="group flex gap-3 px-4 py-4 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                    >
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? "bg-line" : "bg-brand"}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-bold text-ink group-hover:text-brand-strong">{notification.title}</span>
                        <span className="mt-1 block text-sm leading-5 text-ink-muted">{notification.message}</span>
                        <span className="mt-2 block text-xs font-medium text-ink-soft">{notificationTime(notification.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
