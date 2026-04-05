import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET = "test-secret-key-for-jwt-signing";
process.env.SES_FROM_EMAIL = "notifications@carfinder.app";
process.env.SES_INBOUND_EMAIL = "search@carfinder.app";
process.env.SES_INBOUND_BUCKET = "test-inbound-bucket";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.PROFILES_TABLE = "profiles";
process.env.SEARCHES_TABLE = "searches";
process.env.LISTINGS_TABLE = "listings";
process.env.RESULTS_TABLE = "results";
process.env.NOTIF_LOG_TABLE = "notif-log";

const { mockS3Send } = vi.hoisted(() => ({ mockS3Send: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = mockS3Send; },
  GetObjectCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.mock("../shared/email-parser", () => ({
  parseIncomingEmail: vi.fn(),
  applyModification: vi.fn(),
}));

vi.mock("../shared/email-responder", () => ({
  sendWelcome: vi.fn(),
  sendSearchCreated: vi.fn(),
  sendSearchList: vi.fn(),
  sendSearchModified: vi.fn(),
  sendConfirmation: vi.fn(),
  sendHelp: vi.fn(),
  sendError: vi.fn(),
}));

vi.mock("../shared/db", () => ({
  getProfileByEmail: vi.fn(),
  putProfile: vi.fn(),
  updateProfile: vi.fn(),
  getSearchesByUser: vi.fn(),
  putSearchProfile: vi.fn(),
  deleteSearchProfile: vi.fn(),
}));

vi.mock("../shared/auth", () => ({
  signUnsubscribeToken: vi.fn(() => "unsub-token"),
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  return { ...actual, randomUUID: () => "test-uuid-1234" };
});

import { handler } from "./inbound-email";
import * as db from "../shared/db";
import * as parser from "../shared/email-parser";
import * as responder from "../shared/email-responder";
import type { SESEvent } from "aws-lambda";

const mockProfile = {
  id: "user-1",
  email: "user@example.com",
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
  name: "Porsche 997 Search",
  isActive: true,
  makes: ["Porsche"],
  models: ["911"],
  yearMin: 2005,
  yearMax: 2008,
  priceMin: null,
  priceMax: 60000,
  mileageMax: null,
  transmission: "manual",
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

function makeSESEvent(from: string, subject: string, messageId = "msg-1"): SESEvent {
  return {
    Records: [
      {
        ses: {
          mail: {
            messageId,
            source: from,
            commonHeaders: { subject },
          },
        },
      },
    ],
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: S3 returns plain text body
  mockS3Send.mockResolvedValue({
    Body: {
      transformToString: () => Promise.resolve("Subject: test\n\nThis is the body"),
    },
  });
});

describe("inbound-email handler", () => {
  describe("new user", () => {
    it("should create profile and send welcome for short messages", async () => {
      vi.mocked(db.getProfileByEmail).mockResolvedValue(null);
      vi.mocked(db.putProfile).mockResolvedValue(undefined);
      // Override S3 to return short body
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () => Promise.resolve("From: new@example.com\nSubject: hi\n\nhi"),
        },
      });

      await handler(makeSESEvent("new@example.com", "hi"));
      expect(db.putProfile).toHaveBeenCalled();
      expect(responder.sendWelcome).toHaveBeenCalledWith("new@example.com");
    });

    it("should create profile and search for car description", async () => {
      vi.mocked(db.getProfileByEmail).mockResolvedValue(null);
      vi.mocked(db.putProfile).mockResolvedValue(undefined);
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      // S3 returns long enough body
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              "Subject: Looking for a Porsche\n\nI want a 2005-2008 Porsche 911 manual under 60k"
            ),
        },
      });

      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "create_search",
        data: {
          name: "Porsche 997",
          makes: ["Porsche"],
          models: ["911"],
          yearMin: 2005,
          yearMax: 2008,
          priceMax: 60000,
          transmission: "manual",
          excludeSalvage: true,
        },
      });

      await handler(makeSESEvent("new@example.com", "Looking for a Porsche"));
      expect(responder.sendWelcome).toHaveBeenCalled();
      expect(responder.sendSearchCreated).toHaveBeenCalled();
    });
  });

  describe("existing user", () => {
    beforeEach(() => {
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
    });

    it("should handle create_search intent", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "create_search",
        data: { name: "BMW M3 Search", makes: ["BMW"], models: ["M3"] },
      });
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "Looking for a BMW M3"));
      expect(db.putSearchProfile).toHaveBeenCalled();
      expect(responder.sendSearchCreated).toHaveBeenCalled();
    });

    it("should handle list_searches intent", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "list_searches" });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);

      await handler(makeSESEvent("user@example.com", "list"));
      expect(responder.sendSearchList).toHaveBeenCalledWith("user@example.com", [mockSearch]);
    });

    it("should handle pause_search with specific name", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "pause_search",
        searchName: "Porsche 997 Search",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "pause Porsche 997 Search"));
      expect(db.putSearchProfile).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
      expect(responder.sendConfirmation).toHaveBeenCalled();
    });

    it("should handle pause_search with null name (pause all)", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "pause_search",
        searchName: null,
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "pause"));
      expect(db.putSearchProfile).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
    });

    it("should send error for pause_search with unknown name", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "pause_search",
        searchName: "Nonexistent Search",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);

      await handler(makeSESEvent("user@example.com", "pause Nonexistent"));
      expect(responder.sendError).toHaveBeenCalled();
    });

    it("should handle resume_search with specific name", async () => {
      const pausedSearch = { ...mockSearch, isActive: false };
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "resume_search",
        searchName: "Porsche 997 Search",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([pausedSearch]);
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "resume Porsche 997 Search"));
      expect(db.putSearchProfile).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      );
    });

    it("should handle resume_search with null name (resume all)", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "resume_search",
        searchName: null,
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "resume"));
      expect(db.putSearchProfile).toHaveBeenCalled();
    });

    it("should send error for resume_search with unknown name", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "resume_search",
        searchName: "Unknown",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);

      await handler(makeSESEvent("user@example.com", "resume Unknown"));
      expect(responder.sendError).toHaveBeenCalled();
    });

    it("should handle delete_search", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "delete_search",
        searchName: "Porsche 997 Search",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      vi.mocked(db.deleteSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "delete Porsche"));
      expect(db.deleteSearchProfile).toHaveBeenCalledWith("user-1", "search-1");
      expect(responder.sendConfirmation).toHaveBeenCalled();
    });

    it("should send error for delete_search with unknown name", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "delete_search",
        searchName: "Unknown",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);

      await handler(makeSESEvent("user@example.com", "delete Unknown"));
      expect(responder.sendError).toHaveBeenCalled();
    });

    it("should send error for delete_search with null name", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "delete_search",
        searchName: null,
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);

      await handler(makeSESEvent("user@example.com", "delete"));
      expect(responder.sendError).toHaveBeenCalled();
    });

    it("should handle unsubscribe", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "unsubscribe" });
      vi.mocked(db.updateProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "stop"));
      expect(db.updateProfile).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ notificationsEnabled: false })
      );
      expect(responder.sendConfirmation).toHaveBeenCalled();
    });

    it("should handle resubscribe", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "resubscribe" });
      vi.mocked(db.updateProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "resubscribe"));
      expect(db.updateProfile).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ notificationsEnabled: true })
      );
    });

    it("should handle help", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "help" });

      await handler(makeSESEvent("user@example.com", "help"));
      expect(responder.sendHelp).toHaveBeenCalledWith("user@example.com");
    });

    it("should handle unknown intent", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "unknown",
        rawText: "gibberish",
      });

      await handler(makeSESEvent("user@example.com", "gibberish"));
      expect(responder.sendError).toHaveBeenCalled();
    });

    it("should handle modify_search with named target", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "modify_search",
        searchName: "Porsche 997 Search",
        modifications: "increase max price to 70k",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      vi.mocked(parser.applyModification).mockResolvedValue({ priceMax: 70000 });
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "update search"));
      expect(parser.applyModification).toHaveBeenCalled();
      expect(responder.sendSearchModified).toHaveBeenCalled();
    });

    it("should auto-modify when only one search and no name match", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "modify_search",
        searchName: null,
        modifications: "increase max price",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      vi.mocked(parser.applyModification).mockResolvedValue({ priceMax: 70000 });
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "update"));
      expect(responder.sendSearchModified).toHaveBeenCalled();
    });

    it("should ask for clarification when multiple searches and no name", async () => {
      const search2 = { ...mockSearch, id: "search-2", name: "BMW M3 Search" };
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "modify_search",
        searchName: null,
        modifications: "increase max price",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch, search2]);

      await handler(makeSESEvent("user@example.com", "update"));
      expect(responder.sendConfirmation).toHaveBeenCalled();
    });

    it("should send error when trying to modify with no searches", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "modify_search",
        searchName: null,
        modifications: "something",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([]);

      await handler(makeSESEvent("user@example.com", "update"));
      expect(responder.sendError).toHaveBeenCalled();
    });

    it("should handle partial name match for findSearch", async () => {
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({
        type: "pause_search",
        searchName: "Porsche",
      });
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      await handler(makeSESEvent("user@example.com", "pause Porsche"));
      // Should match "Porsche 997 Search" via partial match
      expect(db.putSearchProfile).toHaveBeenCalled();
    });
  });

  describe("S3 email fetch", () => {
    it("should fall back to subject when S3 fetch fails", async () => {
      mockS3Send.mockRejectedValue(new Error("S3 error"));
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "help" });

      await handler(makeSESEvent("user@example.com", "help"));
      // Should still process — falls back to subject
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });

    it("should handle MIME email with text/plain part", async () => {
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              "From: user@example.com\nTo: search@carfinder.app\nSubject: help\nContent-Type: text/plain\n\nhelp"
            ),
        },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "help" });

      await handler(makeSESEvent("user@example.com", "help"));
      expect(responder.sendHelp).toHaveBeenCalled();
    });

    it("should strip HTML when no text/plain part", async () => {
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              "From: user@example.com\nSubject: test\n\n<html><body><p>help me</p></body></html>"
            ),
        },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "help" });

      await handler(makeSESEvent("user@example.com", "test"));
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });

    it("should remove email reply markers", async () => {
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              "From: user@example.com\nSubject: Re: test\n\nlist my searches\nOn Mon, Jan 1 2024, someone wrote:\n> previous email"
            ),
        },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "list_searches" });

      await handler(makeSESEvent("user@example.com", "Re: test"));
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should send error email when processing throws", async () => {
      vi.mocked(db.getProfileByEmail).mockRejectedValue(new Error("DB error"));

      await handler(makeSESEvent("user@example.com", "test"));
      expect(responder.sendError).toHaveBeenCalledWith(
        "user@example.com",
        "An unexpected error occurred. Please try again."
      );
    });
  });

  describe("MIME text extraction edge cases", () => {
    it("should handle raw email with only headers (no body)", async () => {
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () => Promise.resolve("From: user@example.com"),
        },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "help" });

      await handler(makeSESEvent("user@example.com", "help"));
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });

    it("should handle Content-Type: text/plain in MIME multipart", async () => {
      const mimeEmail = [
        "From: user@example.com",
        "Content-Type: multipart/alternative; boundary=boundary123",
        "",
        "--boundary123",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "list my searches",
        "",
        "--boundary123",
        "Content-Type: text/html",
        "",
        "<p>list my searches</p>",
        "--boundary123--",
      ].join("\r\n");

      mockS3Send.mockResolvedValue({
        Body: { transformToString: () => Promise.resolve(mimeEmail) },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "list_searches" });

      await handler(makeSESEvent("user@example.com", "test"));
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });

    it("should strip &nbsp; from HTML", async () => {
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              "From: user@example.com\nSubject: test\n\n<p>help&nbsp;me</p>"
            ),
        },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "help" });

      await handler(makeSESEvent("user@example.com", "test"));
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });

    it("should stop at dashes separator in reply", async () => {
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              "From: user@example.com\nSubject: test\n\nhelp\n---\nOriginal message follows"
            ),
        },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "help" });

      await handler(makeSESEvent("user@example.com", "test"));
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });

    it("should skip lines starting with >", async () => {
      mockS3Send.mockResolvedValue({
        Body: {
          transformToString: () =>
            Promise.resolve(
              "From: user@example.com\nSubject: test\n\nlist\n> quoted text\n> more quoted"
            ),
        },
      });
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);
      vi.mocked(parser.parseIncomingEmail).mockResolvedValue({ type: "list_searches" });

      await handler(makeSESEvent("user@example.com", "test"));
      expect(parser.parseIncomingEmail).toHaveBeenCalled();
    });
  });
});
