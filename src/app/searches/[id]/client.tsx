"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { api } from "@/lib/api";
import type { SearchProfile, SearchResult, Listing } from "@/types";

type ResultWithListing = SearchResult & { listing: Listing };

export default function SearchDetailPage() {
  const params = useParams();
  const searchId = params.id as string;

  const [search, setSearch] = useState<SearchProfile | null>(null);
  const [results, setResults] = useState<ResultWithListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSearches(),
      api.getResults({ search_profile_id: searchId, limit: 100 }),
    ])
      .then(([searches, resultData]) => {
        const found = (searches as SearchProfile[]).find((s) => s.id === searchId);
        setSearch(found || null);
        setResults(resultData as ResultWithListing[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchId]);

  const handleRate = async (searchProfileId: string, listingUrl: string, rating: string) => {
    await api.rateResult(searchProfileId, listingUrl, rating);
    setResults((prev) =>
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
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!search) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Search not found</h1>
        <Link href="/searches" className="mt-4 inline-block text-blue-600 hover:underline">Back to searches</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{search.name}</h1>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${search.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {search.isActive ? "Active" : "Paused"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
            {search.makes?.length ? <span>{search.makes.join(", ")}</span> : null}
            {search.models?.length ? <span>&middot; {search.models.join(", ")}</span> : null}
            {search.yearMin || search.yearMax ? <span>&middot; {search.yearMin || "Any"}-{search.yearMax || "Any"}</span> : null}
            {search.priceMax ? <span>&middot; Under ${search.priceMax.toLocaleString()}</span> : null}
            {search.transmission ? <span className="capitalize">&middot; {search.transmission}</span> : null}
          </div>
          {search.aiNotes && <p className="mt-2 text-sm text-gray-500">AI Notes: {search.aiNotes}</p>}
        </div>
        <Link href={`/searches/${search.id}/edit`} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Edit Search
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {results.length} Match{results.length !== 1 ? "es" : ""}
        </h2>
        {results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-gray-500">No matches found yet. Results appear after the next daily scan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results
              .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
              .map((result) => (
                <ListingCard key={result.listingUrl} result={result} onRate={handleRate} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
