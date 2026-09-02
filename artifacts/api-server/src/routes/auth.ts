import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { GetCurrentUserResponse } from "@workspace/api-zod";
import { authenticateUser, getRequestUser, requireAuth, setSession, systemUsers, updateUserProfile, type AuthUser, type AppRole } from "../lib/auth";
import { db, farmersTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

// In-memory system settings with default values
let systemRates = {
  millingRate: 4.5,
  polishRate: 5.0,
  sackWeight: 50,
  recoveryRate: 68.0,
  millName: "Sitio Camarin Rice Mill",
  location: "Dimataling, Zamboanga del Sur",
};

router.get("/auth/me", requireAuth, (req, res): void => {
  const user = getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(user));
});

router.get("/auth/profile", requireAuth, async (req: any, res: any): Promise<void> => {
  const user = getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  let farmerDetails = null;
  if (user.farmerId) {
    try {
      const [farmer] = await db.select().from(farmersTable).where(eq(farmersTable.id, user.farmerId));
      if (farmer) farmerDetails = farmer;
    } catch {
      // ignore
    }
  }
  res.json({
    user,
    farmerDetails,
  });
});

const handleProfileUpdate = async (req: any, res: any): Promise<void> => {
  try {
    const currentUser = getRequestUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      name,
      email,
      avatar,
      contactNumber,
      address,
      farmArea,
      riceVariety,
    } = req.body ?? {};

    const cleanEmail = email ? email.toLowerCase().trim() : currentUser.email;
    const cleanName = name ? name.trim() : currentUser.name;

    const updated = updateUserProfile(currentUser.id, {
      name: cleanName,
      email: cleanEmail,
      avatar: avatar !== undefined ? avatar : currentUser.avatar,
      contactNumber: contactNumber !== undefined ? contactNumber : currentUser.contactNumber,
      address: address !== undefined ? address : currentUser.address,
      farmArea: farmArea !== undefined ? String(farmArea) : currentUser.farmArea,
      riceVariety: riceVariety !== undefined ? riceVariety : currentUser.riceVariety,
    });

    const userToSave: AuthUser = updated || {
      ...currentUser,
      name: cleanName,
      email: cleanEmail,
      avatar: avatar !== undefined ? avatar : currentUser.avatar,
      contactNumber: contactNumber !== undefined ? contactNumber : currentUser.contactNumber,
      address: address !== undefined ? address : currentUser.address,
      farmArea: farmArea !== undefined ? String(farmArea) : currentUser.farmArea,
      riceVariety: riceVariety !== undefined ? riceVariety : currentUser.riceVariety,
    };

    // Update DB if farmerId is associated
    if (userToSave.farmerId) {
      try {
        await db.update(farmersTable).set({
          fullName: cleanName,
          contactNumber: contactNumber ?? userToSave.contactNumber ?? "09170000000",
          address: address ?? userToSave.address ?? "Sitio Camarin",
          riceVariety: riceVariety ?? userToSave.riceVariety ?? "Dinorado",
          farmArea: farmArea ? String(farmArea) : userToSave.farmArea ?? "0",
        }).where(eq(farmersTable.id, userToSave.farmerId));
      } catch (err) {
        console.warn("Could not sync farmer profile in DB:", err);
      }
    }

    // Update DB usersTable if present
    try {
      await db.update(usersTable).set({
        name: cleanName,
        email: cleanEmail,
        avatar: userToSave.avatar,
      }).where(eq(usersTable.id, userToSave.id));
    } catch {
      // ignore offline DB
    }

    setSession(res, userToSave);
    res.json({
      success: true,
      user: userToSave,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to update profile" });
  }
};

router.put("/auth/profile", requireAuth, handleProfileUpdate);
router.patch("/auth/profile", requireAuth, handleProfileUpdate);
router.post("/auth/profile", requireAuth, handleProfileUpdate);

// Admin system rates settings
router.get("/admin/rates", (_req, res): void => {
  res.json(systemRates);
});

router.put("/admin/rates", requireAuth, (req: any, res: any): void => {
  try {
    const { millingRate, polishRate, sackWeight, recoveryRate, millName, location } = req.body ?? {};
    if (millingRate !== undefined) systemRates.millingRate = Number(millingRate) || 4.5;
    if (polishRate !== undefined) systemRates.polishRate = Number(polishRate) || 5.0;
    if (sackWeight !== undefined) systemRates.sackWeight = Number(sackWeight) || 50;
    if (recoveryRate !== undefined) systemRates.recoveryRate = Number(recoveryRate) || 68.0;
    if (millName) systemRates.millName = String(millName);
    if (location) systemRates.location = String(location);
    res.json({ success: true, rates: systemRates });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to update rates" });
  }
});

const handleLogin = (req: any, res: any): void => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || typeof email !== "string" || !email.trim()) {
      res.status(400).json({ error: "Email address is required" });
      return;
    }
    const user = authenticateUser(email, password);
    setSession(res, user);
    try {
      res.json(GetCurrentUserResponse.parse(user));
    } catch {
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        farmerId: user.farmerId ?? null,
        avatar: user.avatar ?? null,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to authenticate" });
  }
};

router.post("/auth/login", handleLogin);
router.post("/auth/demo-login", handleLogin);

router.post("/auth/register", async (req: any, res: any): Promise<void> => {
  try {
    const { fullName, email, role = "FARMER", contactNumber = "09170000000", address = "Sitio Camarin", farmArea = "1.5", riceVariety = "Dinorado" } = req.body ?? {};
    if (!email || !fullName) {
      res.status(400).json({ error: "Full name and email are required" });
      return;
    }

    // Only FARMER and CUSTOMER (Buyer) can create an account
    const assignedRole: AppRole = role === "CUSTOMER" ? "CUSTOMER" : "FARMER";
    const cleanEmail = email.toLowerCase().trim();

    let farmerId: number | null = null;
    const code = `${assignedRole === "FARMER" ? "FM" : "CUS"}-${Date.now().toString().slice(-4)}`;
    try {
      const [newFarmer] = await db.insert(farmersTable).values({
        farmerCode: code,
        customerNumber: code,
        fullName,
        contactNumber,
        address,
        riceVariety: assignedRole === "FARMER" ? riceVariety : undefined,
        farmArea: assignedRole === "FARMER" ? String(farmArea) : "0",
        customerType: assignedRole as "FARMER" | "CUSTOMER",
      }).returning();
      if (newFarmer) farmerId = newFarmer.id;
    } catch (dbErr) {
      console.warn("Could not insert farmer/buyer profile:", dbErr);
    }

    const user: AuthUser = {
      id: Date.now() % 100000,
      name: fullName,
      email: cleanEmail,
      role: assignedRole,
      farmerId,
      avatar: null,
      contactNumber,
      address,
      farmArea: assignedRole === "FARMER" ? String(farmArea) : undefined,
      riceVariety: assignedRole === "FARMER" ? riceVariety : undefined,
    };

    // Save to in-memory systemUsers so they can log back in
    const existingIndex = systemUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (existingIndex >= 0) {
      systemUsers[existingIndex] = user;
    } else {
      systemUsers.push(user);
    }

    setSession(res, user);
    try {
      res.status(201).json(GetCurrentUserResponse.parse(user));
    } catch {
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        farmerId: user.farmerId ?? null,
        avatar: user.avatar ?? null,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to register account" });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie("camarin_session");
  res.sendStatus(204);
});

export default router;