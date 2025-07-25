import { Router, Request, Response, NextFunction } from "express";
import { makeRenderQueue } from "../render-queue";
import { validateRenderJob } from "../utils/validation";
import { getWebhooks } from "../services/webhook";
import { log, logError } from "../services/logger";

const { PORT = 8989 } = process.env;
const rendersDir = process.env.RENDERS_DIR || "renders";
const queue = makeRenderQueue({ port: Number(PORT), rendersDir });

const router = Router();

router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = validateRenderJob(req.body);
    const jobId = queue.createJob({ ...data });
    log(`Render job created: ${jobId}`, getWebhooks());
    res.json({ jobId });
  } catch (err) {
    logError(`Render job creation failed: ${(err as Error).message}`, getWebhooks());
    next(err);
  }
});

router.get("/:jobId", (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  const job = queue.jobs.get(jobId);
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json(job);
});

router.delete("/:jobId", (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  const job = queue.jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }
  if (job.status !== "queued" && job.status !== "in-progress") {
    return res.status(400).json({ message: "Job is not cancellable" });
  }
  job.cancel();
  log(`Render job cancelled: ${jobId}`, getWebhooks());
  res.json({ message: "Job cancelled" });
});

export default router; 