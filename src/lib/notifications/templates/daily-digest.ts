import type { SearchProfile, SearchResult, Listing } from "@/types";

interface SearchGroup {
  searchProfile: SearchProfile;
  results: (SearchResult & { listing: Listing })[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrice(price: number | null): string {
  if (!price) return "Price N/A";
  return `$${price.toLocaleString()}`;
}

function formatMileage(mileage: number | null): string {
  if (!mileage) return "Mileage N/A";
  return `${mileage.toLocaleString()} mi`;
}

function flagBadge(flag: string): string {
  const colors: Record<string, string> = {
    possible_scam: "#dc2626",
    price_below_market: "#16a34a",
    rare_spec: "#9333ea",
    salvage_title: "#dc2626",
    flood_damage: "#dc2626",
    high_mileage: "#ea580c",
    dealer_listing: "#6b7280",
    no_photos: "#eab308",
    vague_description: "#eab308",
  };
  const color = colors[flag] || "#6b7280";
  const label = flag.replace(/_/g, " ");
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${color};margin-right:4px;margin-bottom:4px;">${escapeHtml(label)}</span>`;
}

function listingCard(result: SearchResult & { listing: Listing }): string {
  const l = result.listing;
  const scorePercent = Math.round((result.ai_score || 0) * 100);
  const scoreColor =
    scorePercent >= 80 ? "#16a34a" : scorePercent >= 60 ? "#ea580c" : "#dc2626";

  const thumbnail = l.image_urls?.[0]
    ? `<img src="${escapeHtml(l.image_urls[0])}" alt="${escapeHtml(l.title || "Car")}" style="width:120px;height:90px;object-fit:cover;border-radius:8px;margin-right:16px;" />`
    : `<div style="width:120px;height:90px;background:#e5e7eb;border-radius:8px;margin-right:16px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">No Photo</div>`;

  const flags = (result.ai_flags || []).map(flagBadge).join("");

  return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;background:white;">
      <div style="display:flex;align-items:flex-start;">
        ${thumbnail}
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <h3 style="margin:0 0 4px 0;font-size:16px;color:#111827;">
                ${l.year ? `${l.year} ` : ""}${escapeHtml(l.make || "")} ${escapeHtml(l.model || "")}
                ${l.trim_level ? `<span style="color:#6b7280;font-weight:normal;"> ${escapeHtml(l.trim_level)}</span>` : ""}
              </h3>
              <p style="margin:0;font-size:14px;color:#374151;">
                <strong>${formatPrice(l.price)}</strong>
                &nbsp;&middot;&nbsp; ${formatMileage(l.mileage)}
                ${l.transmission ? ` &middot; ${escapeHtml(l.transmission)}` : ""}
              </p>
              <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">
                ${escapeHtml(l.location || "Location unknown")} &middot; ${escapeHtml(l.source)}
              </p>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:13px;font-weight:700;color:${scoreColor};background:${scoreColor}15;">
                ${scorePercent}% match
              </span>
            </div>
          </div>
          ${
            result.ai_summary
              ? `<p style="margin:10px 0 6px 0;font-size:13px;color:#374151;line-height:1.5;padding:8px 12px;background:#f9fafb;border-radius:8px;border-left:3px solid #3b82f6;">
                  ${escapeHtml(result.ai_summary)}
                </p>`
              : ""
          }
          ${flags ? `<div style="margin-top:8px;">${flags}</div>` : ""}
          <div style="margin-top:12px;">
            <a href="${escapeHtml(l.url)}" style="display:inline-block;padding:8px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">
              View Listing &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildDigestHTML(searches: SearchGroup[]): string {
  const totalResults = searches.reduce((s, g) => s + g.results.length, 0);

  const searchSections = searches
    .map((group) => {
      const sortedResults = [...group.results].sort(
        (a, b) => (b.ai_score || 0) - (a.ai_score || 0)
      );

      return `
        <div style="margin-bottom:32px;">
          <h2 style="font-size:18px;color:#111827;margin:0 0 4px 0;padding-bottom:8px;border-bottom:2px solid #3b82f6;">
            ${escapeHtml(group.searchProfile.name)}
          </h2>
          <p style="font-size:13px;color:#6b7280;margin:0 0 16px 0;">
            ${sortedResults.length} new listing${sortedResults.length !== 1 ? "s" : ""}
          </p>
          ${sortedResults.map(listingCard).join("")}
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:24px;">
        <!-- Header -->
        <div style="text-align:center;padding:24px 0;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#111827;">
            🚗 CarFinder
          </h1>
          <p style="margin:8px 0 0 0;font-size:14px;color:#6b7280;">
            Your daily car listing digest
          </p>
        </div>

        <!-- Summary -->
        <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:16px;padding:20px 24px;margin-bottom:24px;color:white;text-align:center;">
          <p style="margin:0;font-size:32px;font-weight:800;">${totalResults}</p>
          <p style="margin:4px 0 0 0;font-size:14px;opacity:0.9;">
            new listing${totalResults !== 1 ? "s" : ""} found today
          </p>
        </div>

        <!-- Results -->
        ${searchSections}

        <!-- Footer -->
        <div style="text-align:center;padding:24px 0;border-top:1px solid #e5e7eb;margin-top:24px;">
          <p style="font-size:12px;color:#9ca3af;margin:0;">
            You're receiving this because you have active searches on CarFinder.
          </p>
          <p style="font-size:12px;color:#9ca3af;margin:8px 0 0 0;">
            <a href="\${DASHBOARD_URL}" style="color:#3b82f6;text-decoration:none;">Manage Searches</a>
            &nbsp;&middot;&nbsp;
            <a href="\${SETTINGS_URL}" style="color:#3b82f6;text-decoration:none;">Settings</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
