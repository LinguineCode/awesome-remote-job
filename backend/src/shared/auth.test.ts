import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env before importing module
process.env.JWT_SECRET = "test-secret-key-for-jwt-signing";

import {
  signJWT,
  verifyJWT,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  getUserIdFromCookies,
} from "./auth";

describe("auth", () => {
  describe("signJWT / verifyJWT", () => {
    it("should sign and verify a valid JWT", () => {
      const token = signJWT("user-123", "test@example.com");
      const payload = verifyJWT(token);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe("user-123");
      expect(payload!.email).toBe("test@example.com");
      expect(payload!.iat).toBeTypeOf("number");
      expect(payload!.exp).toBeTypeOf("number");
    });

    it("should create token with custom expiry", () => {
      const token = signJWT("user-123", "test@example.com", 7);
      const payload = verifyJWT(token);
      expect(payload).not.toBeNull();
      const expectedExp = payload!.iat + 7 * 86400;
      expect(payload!.exp).toBe(expectedExp);
    });

    it("should reject tampered token", () => {
      const token = signJWT("user-123", "test@example.com");
      const tampered = token.slice(0, -5) + "xxxxx";
      expect(verifyJWT(tampered)).toBeNull();
    });

    it("should reject expired token", () => {
      // Create a token that expired yesterday
      const token = signJWT("user-123", "test@example.com", -1);
      expect(verifyJWT(token)).toBeNull();
    });

    it("should reject token with wrong number of parts", () => {
      expect(verifyJWT("only.two")).toBeNull();
      expect(verifyJWT("a.b.c.d")).toBeNull();
    });

    it("should reject completely invalid tokens", () => {
      expect(verifyJWT("not-a-jwt")).toBeNull();
    });

    it("should return null for malformed base64url payload", () => {
      // Create a token where the payload is not valid JSON
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from("not-json").toString("base64url");
      const { createHmac } = require("crypto");
      const signature = createHmac("sha256", "test-secret-key-for-jwt-signing")
        .update(`${header}.${payload}`)
        .digest("base64url");
      expect(verifyJWT(`${header}.${payload}.${signature}`)).toBeNull();
    });
  });

  describe("signUnsubscribeToken / verifyUnsubscribeToken", () => {
    it("should sign and verify unsubscribe token", () => {
      const token = signUnsubscribeToken("user-456");
      const userId = verifyUnsubscribeToken(token);
      expect(userId).toBe("user-456");
    });

    it("should return null for invalid token", () => {
      expect(verifyUnsubscribeToken("invalid-token")).toBeNull();
    });
  });

  describe("getUserIdFromCookies", () => {
    it("should extract user ID from valid cookie header", () => {
      const token = signJWT("user-789", "test@example.com");
      const cookieHeader = `token=${token}; other=value`;
      expect(getUserIdFromCookies(cookieHeader)).toBe("user-789");
    });

    it("should return null for undefined cookie header", () => {
      expect(getUserIdFromCookies(undefined)).toBeNull();
    });

    it("should return null for missing token cookie", () => {
      expect(getUserIdFromCookies("other=value")).toBeNull();
    });

    it("should return null for invalid token in cookie", () => {
      expect(getUserIdFromCookies("token=invalid-jwt")).toBeNull();
    });
  });
});
