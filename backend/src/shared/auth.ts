import { createHmac } from "crypto";

const JWT_SECRET = () => process.env.JWT_SECRET!;

interface JWTPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp: number;
}

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8");
}

export function signJWT(userId: string, email: string, expiresInDays = 30): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      email,
      iat: now,
      exp: now + expiresInDays * 86400,
    })
  );
  const signature = createHmac("sha256", JWT_SECRET())
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = createHmac("sha256", JWT_SECRET())
      .update(`${header}.${payload}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(base64urlDecode(payload)) as JWTPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch {
    return null;
  }
}

// Generate a one-click unsubscribe token (long-lived, single-purpose)
export function signUnsubscribeToken(userId: string): string {
  return signJWT(userId, "", 365); // Valid for 1 year
}

export function verifyUnsubscribeToken(token: string): string | null {
  const payload = verifyJWT(token);
  return payload?.sub || null;
}

// Extract JWT from cookie header
export function getUserIdFromCookies(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/token=([^;]+)/);
  if (!match) return null;
  const payload = verifyJWT(match[1]);
  return payload?.sub || null;
}
