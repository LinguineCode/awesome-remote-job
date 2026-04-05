// API client — all requests go through CloudFront to API Gateway at /api/*
const API_BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Auth
export const api = {
  login: (email: string) =>
    request<{ success: boolean; user: unknown }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  me: () => request<{ user: unknown }>("/auth/me"),

  logout: () =>
    request<{ success: boolean }>("/auth/logout", { method: "POST" }),

  // Profile
  updateProfile: (updates: Record<string, unknown>) =>
    request("/profile", {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  resubscribe: () =>
    request("/resubscribe", { method: "POST" }),

  // Searches
  getSearches: () => request<unknown[]>("/searches"),

  createSearch: (data: Record<string, unknown>) =>
    request("/searches", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSearch: (data: Record<string, unknown>) =>
    request("/searches", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSearch: (id: string) =>
    request(`/searches?id=${id}`, { method: "DELETE" }),

  // Results
  getResults: (params?: { search_profile_id?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search_profile_id) query.set("search_profile_id", params.search_profile_id);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<unknown[]>(`/results${qs ? `?${qs}` : ""}`);
  },

  rateResult: (searchProfileId: string, listingUrl: string, userRating: string) =>
    request("/results", {
      method: "PATCH",
      body: JSON.stringify({ searchProfileId, listingUrl, userRating }),
    }),
};
