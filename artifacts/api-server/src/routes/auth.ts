import { Router, type IRouter } from "express";
import {
  DemoLoginBody,
  DemoLoginResponse,
  GetCurrentUserResponse,
} from "@workspace/api-zod";
import { findDemoUser, getRequestUser, requireAuth, setDemoSession } from "../lib/auth";

const router: IRouter = Router();

router.get("/auth/me", requireAuth, (req, res): void => {
  const user = getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(user));
});

router.post("/auth/demo-login", (req, res): void => {
  const parsed = DemoLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = findDemoUser(parsed.data.email, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: "Invalid demo credentials" });
    return;
  }
  setDemoSession(res, user);
  res.json(DemoLoginResponse.parse(user));
});

router.post("/auth/logout", (req, res): void => {
  res.clearCookie("camarin_session");
  res.sendStatus(204);
});

export default router;