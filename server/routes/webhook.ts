import { Router, Request, Response } from "express";
import { validateWebhook } from "../utils/validation";
import { registerWebhook, unregisterWebhook } from "../services/webhook";

const router = Router();

router.post("/register", (req: Request, res: Response) => {
  const { url } = validateWebhook(req.body);
  registerWebhook(url);
  res.json({ message: "Webhook registered", url });
});

router.post("/unregister", (req: Request, res: Response) => {
  const { url } = validateWebhook(req.body);
  unregisterWebhook(url);
  res.json({ message: "Webhook unregistered", url });
});

export default router; 