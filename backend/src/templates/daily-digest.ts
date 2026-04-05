import type { SearchProfile, SearchResult, Listing } from "../shared/types";

interface SearchGroup {
  searchProfile: SearchProfile;
  results: (SearchResult & { listing: Listing })[];
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatPrice(price: number | null): string {
  return price ? `$${price.toLocaleString()}` : "Price N/A";
}

function formatMileage(mileage: number | null): string {
  return mileage ? `${mileage.toLocaleString()} mi` : "Mileage N/A";
}

const FLAG_COLORS: Record<string, string> = {
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

function flagBadge(flag: string): string {
  const color = FLAG_COLORS[flag] || "#6b7280";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${color};margin-right:4px;">${esc(flag.replace(/_/g, " "))}</span>`;
}

function listingCard(result: SearchResult & { listing: Listing }): string {
  const l = result.listing;
  const score = Math.round((result.aiScore || 0) * 100);
  const scoreColor = score >= 80 ? "#16a34a" : score >= 60 ? "#ea580c" : "#dc2626";

  const thumb = l.imageUrls?.[0]
    ? `<img src="${esc(l.imageUrls[0])}" alt="${esc(l.title || "Car")}" style="width:120px;height:90px;object-fit:cover;border-radius:8px;margin-right:16px;" />`
    : `<div style="width:120px;height:90px;background:#e5e7eb;border-radius:8px;margin-right:16px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">No Photo</div>`;

  const flags = (result.aiFlags || []).map(flagBadge).join("");

  return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;background:white;">
      <div style="display:flex;align-items:flex-start;">
        ${thumb}
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;">
            <div>
              <h3 style="margin:0 0 4px;font-size:16px;color:#111827;">${l.year ? `${l.year} ` : ""}${esc(l.make || "")} ${esc(l.model || "")}${l.trimLevel ? ` <span style="color:#6b7280;font-weight:normal;">${esc(l.trimLevel)}</span>` : ""}</h3>
              <p style="margin:0;font-size:14px;color:#374151;"><strong>${formatPrice(l.price)}</strong> &middot; ${formatMileage(l.mileage)}${l.transmission ? ` &middot; ${esc(l.transmission)}` : ""}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${esc(l.location || "Location unknown")} &middot; ${esc(l.source)}</p>
            </div>
            <span style="padding:4px 10px;border-radius:20px;font-size:13px;font-weight:700;color:${scoreColor};background:${scoreColor}15;">${score}% match</span>
          </div>
          ${result.aiSummary ? `<p style="margin:10px 0 6px;font-size:13px;color:#374151;padding:8px 12px;background:#f9fafb;border-radius:8px;border-left:3px solid #3b82f6;">${esc(result.aiSummary)}</p>` : ""}
          ${flags ? `<div style="margin-top:8px;">${flags}</div>` : ""}
          <div style="margin-top:12px;">
            <a href="${esc(l.url)}" style="display:inline-block;padding:8px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">View Listing &rarr;</a>
          </div>
        </div>
      </div>
    </div>`;
}

export function buildDigestHTML(
  searches: SearchGroup[]
): string {
  const total = searches.reduce((s, g) => s + g.results.length, 0);

  const sections = searches
    .map((group) => {
      const sorted = [...group.results].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
      return `
        <div style="margin-bottom:32px;">
          <h2 style="font-size:18px;color:#111827;margin:0 0 4px;padding-bottom:8px;border-bottom:2px solid #3b82f6;">${esc(group.searchProfile.name)}</h2>
          <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">${sorted.length} new listing${sorted.length !== 1 ? "s" : ""}</p>
          ${sorted.map(listingCard).join("")}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:24px 0;">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:#111827;">CarFinder</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Your daily car listing digest</p>
    </div>
    <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:16px;padding:20px 24px;margin-bottom:24px;color:white;text-align:center;">
      <p style="margin:0;font-size:32px;font-weight:800;">${total}</p>
      <p style="margin:4px 0 0;font-size:14px;opacity:0.9;">new listing${total !== 1 ? "s" : ""} found today</p>
    </div>
    ${sections}
    <div style="text-align:center;padding:24px 0;border-top:1px solid #e5e7eb;margin-top:24px;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">
        Reply to this email to manage your searches.
      </p>
      <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;margin-bottom:16px;">
        <strong style="color:#374151;">Quick commands (just reply):</strong><br/>
        &bull; Describe a new car &rarr; creates another search<br/>
        &bull; "list" &rarr; see all your searches<br/>
        &bull; "pause" / "resume" &rarr; control your searches<br/>
        &bull; "stop" &rarr; unsubscribe from all emails
      </div>
      <p style="font-size:11px;color:#d1d5db;margin:0;">
        Reply "stop" to unsubscribe instantly.
      </p>
    </div>
  </div>
</body></html>`;
}
