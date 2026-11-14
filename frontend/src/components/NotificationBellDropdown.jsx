import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, Package, ExternalLink, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useNotificationCenter } from '../context/NotificationCenterContext';

export function NotificationBellDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotificationCenter();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimestamp = (isoString) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getToneIcon = (tone) => {
    switch (tone) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="h-4 w-4 text-[#F95716] shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F95716]/40 dark:border-white/10 dark:bg-[#181E2E] dark:text-slate-300 dark:hover:bg-white/5"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F95716] px-1 text-[11px] font-extrabold text-white shadow-sm ring-2 ring-white dark:ring-[#0E131F]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden dark:border-white/10 dark:bg-[#181E2E]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#F95716]/10 px-2 py-0.5 text-xs font-semibold text-[#F95716]">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  title="Mark all as read"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition dark:text-slate-400 dark:hover:bg-white/5"
                >
                  <CheckCheck size={14} />
                  <span>Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  title="Clear all notifications"
                  onClick={clearAll}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition dark:hover:bg-white/5"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                <Package size={32} className="stroke-[1.5] mb-2 opacity-60" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">All caught up!</p>
                <p className="text-xs mt-1">No new delivery alerts or updates</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className={`flex items-start gap-3 p-3.5 transition cursor-pointer ${
                    item.read
                      ? 'bg-white hover:bg-slate-50 dark:bg-[#181E2E] dark:hover:bg-white/[0.03]'
                      : 'bg-[#F95716]/[0.03] hover:bg-[#F95716]/[0.07] dark:bg-white/[0.04]'
                  }`}
                >
                  {getToneIcon(item.tone)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold truncate ${item.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>

                    {item.link && (
                      <div className="mt-2">
                        <Link
                          to={item.link}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F95716] hover:underline"
                        >
                          <span>{item.trackingNumber ? `Track ${item.trackingNumber}` : 'View details'}</span>
                          <ExternalLink size={11} />
                        </Link>
                      </div>
                    )}
                  </div>
                  {!item.read && (
                    <span className="h-2 w-2 rounded-full bg-[#F95716] shrink-0 mt-1" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/70 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
            <p className="text-[11px] text-slate-400">
              ⚡ Real-time alerts powered by RabbitMQ & SSE
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

