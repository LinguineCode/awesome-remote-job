"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { api } from "@/lib/api";
import type { SearchProfile, SearchResult, Listing } from "@/types";

type ResultWithListing = SearchResult & { listing: Listing };

export default function DashboardPage() {
  const [searches, setSearches] = useState<SearchProfile[]>([]);
  const [recentResults, setRecentResults] = useState<ResultWithListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSearches(),
      api.getResults({ limit: 10 }),
    ])
      .then(([searchData, resultData]) => {
        setSearches(searchData as SearchProfile[]);
        setRecentResults(resultData as ResultWithListing[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRate = async (searchProfileId: string, listingUrl: string, rating: string) => {
    await api.rateResult(searchProfileId, listingUrl, rating);
    setRecentResults((prev) =>
      prev.map((r) =>
        r.searchProfileId === searchProfileId && r.listingUrl === listingUrl
          ? { ...r, userRating: rating }
          : r
      )
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const activeSearches = searches.filter((s) => s.isActive);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your car search overview</p>
        </div>
        <Link href="/searches/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
          + New Search
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Active Searches</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{activeSearches.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total Matches</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{recentResults.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Avg. Match Score</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {recentResults.length > 0
              ? `${Math.round((recentResults.reduce((sum, r) => sum + (r.aiScore || 0), 0) / recentResults.length) * 100)}%`
              : "\u2014"}
          </p>
        </div>
      </div>

      {/* Active Searches */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Searches</h2>
        {activeSearches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-gray-500">No active searches yet.</p>
            <Link href="/searches/new" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
              Create your first search &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeSearches.map((search) => (
              <Link key={search.id} href={`/searches/${search.id}`} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow group">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{search.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {search.makes?.map((m) => (
                    <span key={m} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{m}</span>
                  ))}
                  {search.models?.map((m) => (
                    <span key={m} className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{m}</span>
                  ))}
                  {search.yearMin && <span className="text-xs text-gray-500">{search.yearMin}{search.yearMax ? `\u2013${search.yearMax}` : "+"}</span>}
                  {search.priceMax && <span className="text-xs text-gray-500">Under ${search.priceMax.toLocaleString()}</span>}
                </div>
                {search.aiNotes && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{search.aiNotes}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Results */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Matches</h2>
        {recentResults.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-gray-500">No matches yet. Results will appear here after the daily scan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentResults.map((result) => (
              <ListingCard key={result.listingUrl} result={result} onRate={handleRate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
