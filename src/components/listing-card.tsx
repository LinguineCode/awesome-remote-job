"use client";

import type { SearchResult, Listing } from "@/types";

const FLAG_COLORS: Record<string, { bg: string; text: string }> = {
  possible_scam: { bg: "bg-red-100", text: "text-red-700" },
  price_below_market: { bg: "bg-green-100", text: "text-green-700" },
  rare_spec: { bg: "bg-purple-100", text: "text-purple-700" },
  salvage_title: { bg: "bg-red-100", text: "text-red-700" },
  flood_damage: { bg: "bg-red-100", text: "text-red-700" },
  high_mileage: { bg: "bg-orange-100", text: "text-orange-700" },
  dealer_listing: { bg: "bg-gray-100", text: "text-gray-700" },
  no_photos: { bg: "bg-yellow-100", text: "text-yellow-700" },
  vague_description: { bg: "bg-yellow-100", text: "text-yellow-700" },
};

interface ListingCardProps {
  result: SearchResult & { listing: Listing };
  onRate?: (searchProfileId: string, listingUrl: string, rating: string) => void;
}

export function ListingCard({ result, onRate }: ListingCardProps) {
  const l = result.listing;
  const scorePercent = Math.round((result.aiScore || 0) * 100);
  const scoreColor =
    scorePercent >= 80
      ? "text-green-700 bg-green-50 ring-green-200"
      : scorePercent >= 60
        ? "text-amber-700 bg-amber-50 ring-amber-200"
        : "text-red-700 bg-red-50 ring-red-200";

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex gap-4">
        {l.imageUrls?.[0] ? (
          <img
            src={l.imageUrls[0]}
            alt={l.title || "Car"}
            className="h-24 w-32 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-24 w-32 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
            No Photo
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 truncate">
                {l.year ? `${l.year} ` : ""}
                {l.make || ""} {l.model || ""}
                {l.trimLevel && (
                  <span className="font-normal text-gray-500"> {l.trimLevel}</span>
                )}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {l.price ? `$${l.price.toLocaleString()}` : "Price N/A"}
                </span>
                <span className="text-gray-300">&middot;</span>
                <span>{l.mileage ? `${l.mileage.toLocaleString()} mi` : "Mileage N/A"}</span>
                {l.transmission && (
                  <>
                    <span className="text-gray-300">&middot;</span>
                    <span className="capitalize">{l.transmission}</span>
                  </>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {l.location || "Location unknown"} &middot; {l.source}
              </p>
            </div>
            <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${scoreColor}`}>
              {scorePercent}%
            </span>
          </div>

          {result.aiSummary && (
            <p className="mt-3 text-sm text-gray-700 bg-blue-50 border-l-3 border-blue-500 px-3 py-2 rounded-r-lg leading-relaxed">
              {result.aiSummary}
            </p>
          )}

          {result.aiFlags && result.aiFlags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.aiFlags.map((flag) => {
                const colors = FLAG_COLORS[flag] || { bg: "bg-gray-100", text: "text-gray-700" };
                return (
                  <span key={flag} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                    {flag.replace(/_/g, " ")}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              View Listing &rarr;
            </a>
            {onRate && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => onRate(result.searchProfileId, result.listingUrl, "interested")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    result.userRating === "interested" ? "bg-green-100 text-green-700" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  👍
                </button>
                <button
                  onClick={() => onRate(result.searchProfileId, result.listingUrl, "not_interested")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    result.userRating === "not_interested" ? "bg-red-100 text-red-700" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  👎
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
