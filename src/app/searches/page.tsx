"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchProfile } from "@/types";

export default function SearchesPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/searches")
      .then((r) => r.json())
      .then((data) => setSearches(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete search "${name}"? This cannot be undone.`)) return;

    const response = await fetch(`/api/searches?id=${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setSearches((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleToggle = async (search: SearchProfile) => {
    const response = await fetch("/api/searches", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: search.id,
        is_active: !search.is_active,
      }),
    });

    if (response.ok) {
      setSearches((prev) =>
        prev.map((s) =>
          s.id === search.id ? { ...s, is_active: !s.is_active } : s
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Searches</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your car search profiles
          </p>
        </div>
        <Link
          href="/searches/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + New Search
        </Link>
      </div>

      {searches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            No searches yet
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Create your first search to start finding cars.
          </p>
          <Link
            href="/searches/new"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Create Search
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {searches.map((search) => (
            <div
              key={search.id}
              className={`rounded-xl border bg-white p-5 transition-all ${
                search.is_active
                  ? "border-gray-200"
                  : "border-gray-200 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">
                      {search.name}
                    </h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        search.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {search.is_active ? "Active" : "Paused"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {search.makes?.map((m) => (
                      <span
                        key={m}
                        className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                      >
                        {m}
                      </span>
                    ))}
                    {search.models?.map((m) => (
                      <span
                        key={m}
                        className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                      >
                        {m}
                      </span>
                    ))}
                    {(search.year_min || search.year_max) && (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {search.year_min || "Any"}–{search.year_max || "Any"}
                      </span>
                    )}
                    {(search.price_min || search.price_max) && (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        ${search.price_min?.toLocaleString() || "0"}–$
                        {search.price_max?.toLocaleString() || "Any"}
                      </span>
                    )}
                    {search.transmission && (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">
                        {search.transmission}
                      </span>
                    )}
                  </div>

                  {search.ai_notes && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      AI Notes: {search.ai_notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Link
                    href={`/searches/${search.id}`}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    View Results
                  </Link>
                  <Link
                    href={`/searches/${search.id}/edit`}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleToggle(search)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {search.is_active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDelete(search.id, search.name)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
