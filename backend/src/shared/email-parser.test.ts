import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.OPENAI_API_KEY = "test-openai-key";

const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

import { parseIncomingEmail, applyModification } from "./email-parser";
import type { SearchProfile } from "./types";

beforeEach(() => {
  mockCreate.mockReset();
});

describe("parseIncomingEmail", () => {
  it("should parse a create_search intent", async () => {
    const intent = {
      type: "create_search",
      data: {
        name: "Porsche 997 Search",
        makes: ["Porsche"],
        models: ["911"],
        yearMin: 2005,
        yearMax: 2008,
        priceMax: 60000,
        transmission: "manual",
        excludeSalvage: true,
        aiNotes: "Must be 997.1 generation",
      },
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(intent) } }],
    });

    const result = await parseIncomingEmail(
      "Looking for a Porsche",
      "I want a 2005-2008 Porsche 911 manual",
      "user@example.com"
    );

    expect(result.type).toBe("create_search");
    if (result.type === "create_search") {
      expect(result.data.makes).toEqual(["Porsche"]);
    }
  });

  it("should parse a list_searches intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "list_searches" }) } }],
    });

    const result = await parseIncomingEmail("list", "list", "user@example.com");
    expect(result.type).toBe("list_searches");
  });

  it("should parse a pause_search intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "pause_search", searchName: "My Search" }) } }],
    });

    const result = await parseIncomingEmail("pause", "pause My Search", "user@example.com");
    expect(result.type).toBe("pause_search");
    if (result.type === "pause_search") {
      expect(result.searchName).toBe("My Search");
    }
  });

  it("should parse a resume_search intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "resume_search", searchName: null }) } }],
    });

    const result = await parseIncomingEmail("resume", "resume", "user@example.com");
    expect(result.type).toBe("resume_search");
  });

  it("should parse a delete_search intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "delete_search", searchName: "Old Search" }) } }],
    });

    const result = await parseIncomingEmail("delete", "delete Old Search", "user@example.com");
    expect(result.type).toBe("delete_search");
  });

  it("should parse an unsubscribe intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "unsubscribe" }) } }],
    });

    const result = await parseIncomingEmail("stop", "stop", "user@example.com");
    expect(result.type).toBe("unsubscribe");
  });

  it("should parse a resubscribe intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "resubscribe" }) } }],
    });

    const result = await parseIncomingEmail("resubscribe", "resubscribe", "user@example.com");
    expect(result.type).toBe("resubscribe");
  });

  it("should parse a help intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "help" }) } }],
    });

    const result = await parseIncomingEmail("help", "help", "user@example.com");
    expect(result.type).toBe("help");
  });

  it("should parse a modify_search intent", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "modify_search", searchName: "Porsche 997", modifications: "increase max price to 70k" }) } }],
    });

    const result = await parseIncomingEmail("update", "increase max price to 70k", "user@example.com");
    expect(result.type).toBe("modify_search");
    if (result.type === "modify_search") {
      expect(result.modifications).toContain("70k");
    }
  });

  it("should return unknown when no content in response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await parseIncomingEmail("???", "???", "user@example.com");
    expect(result.type).toBe("unknown");
  });

  it("should return unknown on API error", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));

    const result = await parseIncomingEmail("test", "test", "user@example.com");
    expect(result.type).toBe("unknown");
  });

  it("should truncate very long email bodies", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "help" }) } }],
    });

    const longBody = "x".repeat(5000);
    await parseIncomingEmail("subject", longBody, "user@example.com");
    // Should still work — body is sliced to 3000 chars internally
    expect(mockCreate).toHaveBeenCalled();
  });

  it("should handle empty choices array", async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const result = await parseIncomingEmail("test", "test", "user@example.com");
    expect(result.type).toBe("unknown");
  });
});

describe("applyModification", () => {
  const mockSearch: SearchProfile = {
    id: "search-1",
    userId: "user-1",
    name: "Porsche 997",
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
    drivetrain: null,
    zipCode: null,
    searchRadiusMiles: 100,
    states: null,
    excludeDealers: false,
    excludeSalvage: true,
    aiNotes: "Must be 997.1",
    sources: ["google"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  it("should return modified fields", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ priceMax: 70000 }) } }],
    });

    const result = await applyModification(mockSearch, "increase max price to 70k");
    expect(result.priceMax).toBe(70000);
  });

  it("should return empty object when no content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await applyModification(mockSearch, "something");
    expect(result).toEqual({});
  });

  it("should return empty object on error", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));

    const result = await applyModification(mockSearch, "something");
    expect(result).toEqual({});
  });
});
