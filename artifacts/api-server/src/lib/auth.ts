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
};

const demoUsers: Array<AuthUser & { passwordHash: string }> = [
  { id: 1, name: "Carmela Camarin", email: "admin@camarinricemill.local", role: "ADMIN", farmerId: null, avatar: null, passwordHash: "ab2bae05ecee947ee8c9f998202a4123dc0be6fa731a3976091d6568475aab1d" },
  { id: 2, name: "Mila Santos", email: "staff@camarinricemill.local", role: "STAFF", farmerId: null, avatar: null, passwordHash: "e161632968ae67552f30a31480939b2c3fe72c41aaec700eb9c2ba0e8ebd7d8e" },
  { id: 3, name: "Juan Dela Cruz", email: "farmer@camarinricemill.local", role: "FARMER", farmerId: 1, avatar: null, passwordHash: "4ca49b42ed9db481bc4afc6b57ba900a530c939e4b33e42acf48fdcc9c700bbe" },
  { id: 4, name: "Ana Flores", email: "customer@camarinricemill.local", role: "CUSTOMER", farmerId: 5, avatar: null, passwordHash: "cb0521b10f5a06535cc48769564260cc116e85d7873a8edddf719277af22c1b8" },
];

function signingKey(): string {
  return process.env.SESSION_SECRET ?? "camarin-development-session-key";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", signingKey()).update(value).digest("base64url");
}

function serializeUser(user: AuthUser): string {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function deserializeUser(value: string | undefined): AuthUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id: number; exp: number };
    if (parsed.exp < Date.now()) return null;
    const user = demoUsers.find((candidate) => candidate.id === parsed.id);
    if (!user) return null;
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  } catch {
    return null;
  }
}

export function findDemoUser(email: string, password: string): AuthUser | null {
  const user = demoUsers.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;
  const hash = crypto.scryptSync(password, `camarin-${user.id}`, 32).toString("hex");
  if (hash !== user.passwordHash) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function setDemoSession(res: { cookie: (name: string, value: string, options: Record<string, unknown>) => void }, user: AuthUser): void {
  res.cookie("camarin_session", serializeUser(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function getRequestUser(req: Request): AuthUser | null {
  try {
    const clerk = getAuth(req);
    if (clerk?.userId) {
      const raw = Array.isArray(clerk.userId) ? clerk.userId[0] : clerk.userId;
      const userId = Number.parseInt(raw.replace(/\D/g, "").slice(-6), 10);
      if (Number.isFinite(userId)) return demoUsers.find((candidate) => candidate.id === userId) ?? null;
    }
  } catch {
    // Clerk is intentionally optional for demo sessions in development.
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