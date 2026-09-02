import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { getAuth } from "@clerk/express";

export type AppRole = "ADMIN" | "STAFF" | "FARMER" | "CUSTOMER";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  farmerId: number | null;
  avatar: string | null;
  contactNumber?: string | null;
  address?: string | null;
  farmArea?: string | null;
  riceVariety?: string | null;
};

export const systemUsers: Array<AuthUser> = [
  { id: 1, name: "Carmela Camarin", email: "admin@camarinricemill.local", role: "ADMIN", farmerId: null, avatar: null, contactNumber: "0917-123-4567", address: "Sitio Camarin, Kaagwasan, Dimataling" },
  { id: 2, name: "Mila Santos", email: "staff@camarinricemill.local", role: "STAFF", farmerId: null, avatar: null, contactNumber: "0918-234-5678", address: "Poblacion, Dimataling" },
  { id: 3, name: "Juan Dela Cruz", email: "farmer@camarinricemill.local", role: "FARMER", farmerId: 1, avatar: null, contactNumber: "0919-345-6789", address: "Sitio Camarin, Kaagwasan", farmArea: "2.5", riceVariety: "Dinorado" },
  { id: 4, name: "Ana Flores", email: "customer@camarinricemill.local", role: "CUSTOMER", farmerId: 5, avatar: null, contactNumber: "0920-456-7890", address: "Barangay Kaagwasan" },
];

export function updateUserProfile(id: number, updates: Partial<AuthUser>): AuthUser | null {
  const index = systemUsers.findIndex((u) => u.id === id);
  if (index === -1) {
    // If not in systemUsers list yet, find by email or create
    return null;
  }
  systemUsers[index] = {
    ...systemUsers[index],
    ...updates,
    id, // protect id
  };
  return systemUsers[index];
}

function signingKey(): string {
  return process.env.SESSION_SECRET ?? "camarin-production-session-key";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", signingKey()).update(value).digest("base64url");
}

export function serializeUser(user: AuthUser): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function deserializeUser(value: string | undefined): AuthUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthUser & { exp: number };
    if (parsed.exp < Date.now()) return null;
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      farmerId: parsed.farmerId ?? null,
      avatar: parsed.avatar ?? null,
      contactNumber: parsed.contactNumber ?? null,
      address: parsed.address ?? null,
      farmArea: parsed.farmArea ?? null,
      riceVariety: parsed.riceVariety ?? null,
    };
  } catch {
    return null;
  }
}

export function authenticateUser(email: string, _password?: string): AuthUser {
  const cleanEmail = email.toLowerCase().trim();
  const existing = systemUsers.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) return existing;

  // Determine role based on email hint
  let role: AppRole = "FARMER"; // Safe default for public users
  if (cleanEmail === "admin@camarinricemill.local" || cleanEmail.startsWith("admin@") || cleanEmail.includes("admin")) {
    role = "ADMIN";
  } else if (cleanEmail === "staff@camarinricemill.local" || cleanEmail.startsWith("staff@") || cleanEmail.includes("cashier") || cleanEmail.includes("operator")) {
    role = "STAFF";
  } else if (cleanEmail.includes("buyer") || cleanEmail.includes("customer")) {
    role = "CUSTOMER";
  } else {
    role = "FARMER";
  }

  const nameParts = cleanEmail.split("@")[0].split(/[\._-]/);
  const formattedName = nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || "User";

  const newUser: AuthUser = {
    id: systemUsers.length + 100,
    name: formattedName,
    email: cleanEmail,
    role,
    farmerId: role === "FARMER" ? 1 : role === "CUSTOMER" ? 5 : null,
    avatar: null,
  };
  systemUsers.push(newUser);
  return newUser;
}

export function setSession(res: { cookie: (name: string, value: string, options: Record<string, unknown>) => void }, user: AuthUser): void {
  res.cookie("camarin_session", serializeUser(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
  });
}

// Aliases for compatibility
export const findDemoUser = (email: string, password?: string) => authenticateUser(email, password);
export const setDemoSession = (res: any, user: AuthUser) => setSession(res, user);

export function getRequestUser(req: Request): AuthUser | null {
  try {
    const clerk = getAuth(req);
    if (clerk?.userId) {
      const raw = Array.isArray(clerk.userId) ? clerk.userId[0] : clerk.userId;
      const userId = Number.parseInt(raw.replace(/\D/g, "").slice(-6), 10);
      if (Number.isFinite(userId)) return systemUsers.find((candidate) => candidate.id === userId) ?? null;
    }
  } catch {
    // Clerk is optional
  }
  return deserializeUser(req.cookies?.camarin_session);
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!getRequestUser(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

export function requireRole(...roles: AppRole[]): RequestHandler {
  return (req, res, next) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    next();
  };
}