import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SES_FROM_EMAIL = "notifications@carfinder.app";
process.env.ENVIRONMENT = "test";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: class { send = mockSend; },
  SendEmailCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.mock("./db", () => ({
  getProfileById: vi.fn(),
  getUnnotifiedResultsByUser: vi.fn(),
  getListingsBatch: vi.fn(),
  getSearchesByUser: vi.fn(),
  markResultsNotified: vi.fn(),
  logNotification: vi.fn(),
}));

vi.mock("../templates/daily-digest", () => ({
  buildDigestHTML: vi.fn(() => "<html>digest</html>"),
}));

import { sendDigestForUser } from "./email";
import * as db from "./db";

const mockProfile = {
  id: "user-1",
  email: "test@example.com",
  displayName: null,
  notificationHour: 8,
  timezone: "America/New_York",
  isActive: true,
  notificationsEnabled: true,
  unsubscribeToken: "tok",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockSearch = {
  id: "search-1",
  userId: "user-1",
  name: "Porsche Search",
  isActive: true,
  makes: ["Porsche"],
  models: ["911"],
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  mileageMax: null,
  transmission: null,
  bodyStyles: null,
  colors: null,
  drivetrain: null,
  zipCode: null,
  searchRadiusMiles: 100,
  states: null,
  excludeDealers: false,
  excludeSalvage: true,
  aiNotes: null,
  sources: ["google"],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockListing = {
  url: "https://example.com/car1",
  title: "2007 Porsche 911",
  price: 55000,
  year: 2007,
  make: "Porsche",
  model: "911",
  trimLevel: "Carrera S",
  mileage: 45000,
  transmission: "manual",
  drivetrain: "rwd",
  color: "Silver",
  location: "LA, CA",
  description: "Great car",
  imageUrls: ["https://img.com/1.jpg"],
  sellerType: "private",
  titleStatus: "clean",
  source: "google:cargurus.com",
  firstSeenAt: "2024-01-01T00:00:00Z",
  lastSeenAt: "2024-01-01T00:00:00Z",
  expiresAt: 9999999999,
};

const mockResult = {
  searchProfileId: "search-1",
  listingUrl: "https://example.com/car1",
  userId: "user-1",
  matchedAt: "2024-01-01T00:00:00Z",
  aiScore: 0.85,
  aiSummary: "Great match",
  aiFlags: [],
  aiReasoning: "Match",
  isNotified: false,
  notifiedAt: null,
  userRating: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendDigestForUser", () => {
  it("should return false when profile not found", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue(null);
    expect(await sendDigestForUser("user-1")).toBe(false);
  });

  it("should return false when profile is inactive", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue({ ...mockProfile, isActive: false });
    expect(await sendDigestForUser("user-1")).toBe(false);
  });

  it("should return false when notifications disabled", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue({ ...mockProfile, notificationsEnabled: false });
    expect(await sendDigestForUser("user-1")).toBe(false);
  });

  it("should return false when no unnotified results", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
    vi.mocked(db.getUnnotifiedResultsByUser).mockResolvedValue([]);
    expect(await sendDigestForUser("user-1")).toBe(false);
  });

  it("should return false when no matching groups (orphaned results)", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
    vi.mocked(db.getUnnotifiedResultsByUser).mockResolvedValue([mockResult]);
    vi.mocked(db.getListingsBatch).mockResolvedValue([]); // no listings found
    vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
    expect(await sendDigestForUser("user-1")).toBe(false);
  });

  it("should send digest and return true on success", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
    vi.mocked(db.getUnnotifiedResultsByUser).mockResolvedValue([mockResult]);
    vi.mocked(db.getListingsBatch).mockResolvedValue([mockListing]);
    vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
    mockSend.mockResolvedValue({});
    vi.mocked(db.markResultsNotified).mockResolvedValue(undefined);
    vi.mocked(db.logNotification).mockResolvedValue(undefined);

    const result = await sendDigestForUser("user-1");
    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(db.markResultsNotified).toHaveBeenCalled();
    expect(db.logNotification).toHaveBeenCalledWith("user-1", "test@example.com", 1, "sent");
  });

  it("should use singular 'match' for single result", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
    vi.mocked(db.getUnnotifiedResultsByUser).mockResolvedValue([mockResult]);
    vi.mocked(db.getListingsBatch).mockResolvedValue([mockListing]);
    vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
    mockSend.mockResolvedValue({});
    vi.mocked(db.markResultsNotified).mockResolvedValue(undefined);
    vi.mocked(db.logNotification).mockResolvedValue(undefined);

    await sendDigestForUser("user-1");
    // The Subject should contain "1 new match" (singular)
    const sendCall = mockSend.mock.calls[0][0];
    expect(sendCall.input.Message.Subject.Data).toContain("1 new match ");
  });

  it("should use plural 'matches' for multiple results", async () => {
    const result2 = { ...mockResult, listingUrl: "https://example.com/car2" };
    const listing2 = { ...mockListing, url: "https://example.com/car2" };

    vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
    vi.mocked(db.getUnnotifiedResultsByUser).mockResolvedValue([mockResult, result2]);
    vi.mocked(db.getListingsBatch).mockResolvedValue([mockListing, listing2]);
    vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
    mockSend.mockResolvedValue({});
    vi.mocked(db.markResultsNotified).mockResolvedValue(undefined);
    vi.mocked(db.logNotification).mockResolvedValue(undefined);

    await sendDigestForUser("user-1");
    const sendCall = mockSend.mock.calls[0][0];
    expect(sendCall.input.Message.Subject.Data).toContain("matches");
  });

  it("should return false and log failure on SES error", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
    vi.mocked(db.getUnnotifiedResultsByUser).mockResolvedValue([mockResult]);
    vi.mocked(db.getListingsBatch).mockResolvedValue([mockListing]);
    vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
    mockSend.mockRejectedValue(new Error("SES quota exceeded"));
    vi.mocked(db.logNotification).mockResolvedValue(undefined);

    const result = await sendDigestForUser("user-1");
    expect(result).toBe(false);
    expect(db.logNotification).toHaveBeenCalledWith("user-1", "test@example.com", 1, "failed");
  });

  it("should skip results with no matching search profile", async () => {
    const orphanResult = { ...mockResult, searchProfileId: "orphan-search" };
    vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
    vi.mocked(db.getUnnotifiedResultsByUser).mockResolvedValue([orphanResult]);
    vi.mocked(db.getListingsBatch).mockResolvedValue([mockListing]);
    vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]); // search-1, not orphan-search
    expect(await sendDigestForUser("user-1")).toBe(false);
  });
});
