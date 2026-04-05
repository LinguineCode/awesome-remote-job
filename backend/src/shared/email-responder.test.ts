import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SES_FROM_EMAIL = "notifications@carfinder.app";
process.env.SES_INBOUND_EMAIL = "search@carfinder.app";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: class { send = mockSend; },
  SendEmailCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

import {
  sendWelcome,
  sendSearchCreated,
  sendSearchList,
  sendSearchModified,
  sendConfirmation,
  sendHelp,
  sendError,
} from "./email-responder";
import type { SearchProfile } from "./types";

const mockSearch: SearchProfile = {
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
  mileageMax: 80000,
  transmission: "manual",
  bodyStyles: null,
  colors: null,
  drivetrain: "rwd",
  zipCode: null,
  searchRadiusMiles: 100,
  states: null,
  excludeDealers: true,
  excludeSalvage: true,
  aiNotes: "Must be 997.1 generation. Prefer sport chrono.",
  sources: ["google"],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
});

describe("email-responder", () => {
  describe("sendWelcome", () => {
    it("should send welcome email with commands list", async () => {
      await sendWelcome("test@example.com");
      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Destination.ToAddresses).toEqual(["test@example.com"]);
      expect(cmd.input.Message.Subject.Data).toContain("Welcome");
      expect(cmd.input.Message.Body.Html.Data).toContain("CarFinder");
    });
  });

  describe("sendWelcome (no SES_INBOUND_EMAIL)", () => {
    it("should fall back to FROM email as reply-to when SES_INBOUND_EMAIL is not set", async () => {
      const orig = process.env.SES_INBOUND_EMAIL;
      delete process.env.SES_INBOUND_EMAIL;
      await sendWelcome("test@example.com");
      expect(mockSend).toHaveBeenCalledOnce();
      process.env.SES_INBOUND_EMAIL = orig;
    });
  });

  describe("sendSearchCreated", () => {
    it("should send search created email with criteria summary", async () => {
      await sendSearchCreated("test@example.com", mockSearch);
      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Message.Subject.Data).toContain("Porsche 997 Search");
      const html = cmd.input.Message.Body.Html.Data;
      expect(html).toContain("Porsche");
      expect(html).toContain("911");
      expect(html).toContain("manual");
      expect(html).toContain("RWD");
      expect(html).toContain("Private sellers only");
      expect(html).toContain("Clean title only");
      expect(html).toContain("997.1 generation");
    });

    it("should handle search with yearMin but no yearMax", async () => {
      const search = { ...mockSearch, yearMin: 2005, yearMax: null };
      await sendSearchCreated("test@example.com", search);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("should handle search with yearMax but no yearMin", async () => {
      const search = { ...mockSearch, yearMin: null, yearMax: 2010 };
      await sendSearchCreated("test@example.com", search);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("should handle search with minimal criteria", async () => {
      const minimal = {
        ...mockSearch,
        makes: null,
        models: null,
        yearMin: null,
        yearMax: null,
        priceMax: null,
        mileageMax: null,
        transmission: null,
        drivetrain: null,
        excludeDealers: false,
        excludeSalvage: false,
        aiNotes: null,
      };

      await sendSearchCreated("test@example.com", minimal);
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe("sendSearchList", () => {
    it("should send list of searches", async () => {
      await sendSearchList("test@example.com", [mockSearch]);
      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Message.Subject.Data).toContain("1");
      const html = cmd.input.Message.Body.Html.Data;
      expect(html).toContain("Porsche 997 Search");
      expect(html).toContain("Active");
    });

    it("should handle empty search list", async () => {
      await sendSearchList("test@example.com", []);
      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      const html = cmd.input.Message.Body.Html.Data;
      expect(html).toContain("don't have any searches");
    });

    it("should show paused status", async () => {
      const paused = { ...mockSearch, isActive: false };
      await sendSearchList("test@example.com", [paused]);
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html.Data;
      expect(html).toContain("Paused");
    });

    it("should show year range in list", async () => {
      const search = { ...mockSearch, yearMin: 2005, yearMax: 2010 };
      await sendSearchList("test@example.com", [search]);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("should show priceMax in list", async () => {
      const search = { ...mockSearch, priceMax: 60000 };
      await sendSearchList("test@example.com", [search]);
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html.Data;
      expect(html).toContain("60,000");
    });

    it("should handle search with only yearMin in list", async () => {
      const search = { ...mockSearch, yearMin: 2005, yearMax: null };
      await sendSearchList("test@example.com", [search]);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("should handle search with no optional display fields", async () => {
      const minimal = {
        ...mockSearch,
        makes: null,
        yearMin: null,
        yearMax: null,
        priceMax: null,
        transmission: null,
        aiNotes: null,
      };
      await sendSearchList("test@example.com", [minimal]);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("should truncate long aiNotes in list view", async () => {
      const longNotes = { ...mockSearch, aiNotes: "x".repeat(200) };
      await sendSearchList("test@example.com", [longNotes]);
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html.Data;
      expect(html).toContain("...");
    });

    it("should not truncate short aiNotes", async () => {
      const shortNotes = { ...mockSearch, aiNotes: "short" };
      await sendSearchList("test@example.com", [shortNotes]);
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html.Data;
      expect(html).not.toContain("...");
    });
  });

  describe("sendSearchModified", () => {
    it("should send modification confirmation", async () => {
      await sendSearchModified("test@example.com", mockSearch, "Max price updated to $70k.");
      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Message.Subject.Data).toContain("Porsche 997 Search");
      const html = cmd.input.Message.Body.Html.Data;
      expect(html).toContain("Max price updated to $70k.");
      expect(html).toContain("997.1 generation");
    });

    it("should handle modified search with no aiNotes", async () => {
      const noNotes = { ...mockSearch, aiNotes: null };
      await sendSearchModified("test@example.com", noNotes, "Updated.");
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe("sendConfirmation", () => {
    it("should send a generic confirmation email", async () => {
      await sendConfirmation("test@example.com", "Done", "Your request has been processed.");
      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Message.Subject.Data).toBe("Done");
      expect(cmd.input.Message.Body.Html.Data).toContain("Your request has been processed.");
    });
  });

  describe("sendHelp", () => {
    it("should send help email with all commands", async () => {
      await sendHelp("test@example.com");
      expect(mockSend).toHaveBeenCalledOnce();
      const html = mockSend.mock.calls[0][0].input.Message.Body.Html.Data;
      expect(html).toContain("list");
      expect(html).toContain("pause");
      expect(html).toContain("resume");
      expect(html).toContain("delete");
      expect(html).toContain("stop");
      expect(html).toContain("help");
    });
  });

  describe("sendError", () => {
    it("should send error email", async () => {
      await sendError("test@example.com", "Something went wrong.");
      expect(mockSend).toHaveBeenCalledOnce();
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Message.Subject.Data).toContain("Couldn't process");
      expect(cmd.input.Message.Body.Html.Data).toContain("Something went wrong.");
    });
  });
});
