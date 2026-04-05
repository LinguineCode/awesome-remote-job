"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import type { SearchProfile } from "@/types";

export default function EditSearchPage() {
  const params = useParams();
  const searchId = params.id as string;

  const [search, setSearch] = useState<SearchProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/searches")
      .then((r) => r.json())
      .then((searches) => {
        const found = (Array.isArray(searches) ? searches : []).find(
          (s: SearchProfile) => s.id === searchId
        );
        setSearch(found || null);
      })
      .finally(() => setLoading(false));
  }, [searchId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-96 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!search) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Search not found</h1>
        <Link
          href="/searches"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to searches
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit Search</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update your search criteria for &quot;{search.name}&quot;
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <SearchForm mode="edit" initialData={search} />
      </div>
    </div>
  );
}
