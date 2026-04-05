"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Profile } from "@/types";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Berlin",
  "Asia/Tokyo", "Australia/Sydney",
];

export default function SettingsPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [notificationHour, setNotificationHour] = useState(8);
  const [timezone, setTimezone] = useState("America/New_York");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    api.me()
      .then((data) => {
        const u = data.user as Profile | null;
        if (u) {
          setUser(u);
          setDisplayName(u.displayName || "");
          setNotificationHour(u.notificationHour || 8);
          setTimezone(u.timezone || "America/New_York");
          setNotificationsEnabled(u.notificationsEnabled ?? true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    try {
      const updated = await api.updateProfile({
        displayName,
        notificationHour,
        timezone,
        notificationsEnabled,
      });
      setUser(updated as Profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-gray-500">Please log in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 space-y-6">
        {/* Account */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={user.email} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
          <div className="space-y-4">
            {/* Email toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Receive daily digest emails with new matches
                </p>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  notificationsEnabled ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    notificationsEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {!notificationsEnabled && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                Email notifications are off. Your searches still run daily, but you won&apos;t receive emails. You can check results in the dashboard.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Digest Time</label>
              <select
                value={notificationHour}
                onChange={(e) => setNotificationHour(parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="pt-6 border-t border-gray-200 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Settings saved!</span>}
        </div>
      </div>
    </div>
  );
}
