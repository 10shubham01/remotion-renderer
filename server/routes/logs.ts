import { Router, Response } from "express";
import { getLogs } from "../services/logger";

const router = Router();

router.get("/", (_, res: Response) => {
  res.json({ logs: getLogs() });
});

export default router; 