"use client";

import { SearchForm } from "@/components/search-form";

export default function NewSearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Search</h1>
        <p className="text-sm text-gray-500 mt-1">
          Set your criteria and let AI find your perfect car.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        <SearchForm mode="create" />
      </div>
    </div>
  );
}
