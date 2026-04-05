"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "resubscribed">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Missing unsubscribe token.");
      return;
    }

    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMessage(data.error || "Failed to unsubscribe.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Network error. Please try again.");
      });
  }, [token]);

  const handleResubscribe = async () => {
    try {
      await api.resubscribe();
      setStatus("resubscribed");
    } catch {
      // User might not be logged in — that's OK
      setErrorMessage("Please log in to resubscribe, or visit Settings.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === "loading" && (
          <div>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="mt-4 text-gray-600">Unsubscribing...</p>
          </div>
        )}

        {status === "success" && (
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              You&apos;ve been unsubscribed
            </h1>
            <p className="mt-2 text-gray-600">
              You won&apos;t receive any more daily digest emails from CarFinder.
              Your searches are still saved — we just won&apos;t email you.
            </p>
            <div className="mt-8 space-y-3">
              <button
                onClick={handleResubscribe}
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Changed your mind? Resubscribe
              </button>
              <Link
                href="/settings"
                className="block w-full rounded-lg px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Manage notification settings
              </Link>
              <Link
                href="/dashboard"
                className="block text-sm text-gray-500 hover:text-gray-700"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        )}

        {status === "resubscribed" && (
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Welcome back!
            </h1>
            <p className="mt-2 text-gray-600">
              You&apos;ll receive daily digest emails again starting tomorrow.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {status === "error" && (
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-gray-600">{errorMessage}</p>
            <Link
              href="/settings"
              className="mt-6 inline-block text-sm text-blue-600 hover:underline"
            >
              Try managing your settings instead
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
