import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import riceMillRouter from "./rice-mill";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(riceMillRouter);

export default router;
