import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet"; // If types missing: npm i -D @types/helmet
import cors from "cors"; // If types missing: npm i -D @types/cors
import { getLogs, makeRenderQueue } from "./render-queue";
import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";

const { PORT = 8989 } = process.env;

function setupApp() {
  const app = express();
  const rendersDir = path.resolve("renders");
  const queue = makeRenderQueue({
    port: Number(PORT),
    rendersDir,
  });

  // Production middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // Log viewing endpoint
  app.get("/logs", (req, res) => {
    res.json({ logs: getLogs() });
  });

  // Host renders on /renders
  app.use("/renders", express.static(rendersDir));

  // Endpoint to create a new job
  app.post("/renders", async (req, res, next) => {
    try {
      const { titleText = "Hello, world!", compositionId, serveUrl } = req.body || {};
      if (typeof titleText !== "string") {
        return res.status(400).json({ message: "titleText must be a string" });
      }
      if (typeof compositionId !== "string" || !compositionId) {
        return res.status(400).json({ message: "compositionId is required and must be a string" });
      }
      if (typeof serveUrl !== "string" || !serveUrl) {
        return res.status(400).json({ message: "serveUrl is required and must be a string" });
      }
      const jobId = queue.createJob({ titleText, compositionId, serveUrl });
      res.json({ jobId });
    } catch (err) {
      next(err);
    }
  });

  // Endpoint to get a job status
  app.get("/renders/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    const job = queue.jobs.get(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });

  // Endpoint to cancel a job
  app.delete("/renders/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    const job = queue.jobs.get(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status !== "queued" && job.status !== "in-progress") {
      return res.status(400).json({ message: "Job is not cancellable" });
    }
    job.cancel();
    res.json({ message: "Job cancelled" });
  });

  // Error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}

async function main() {
  await ensureBrowser();
  const app = setupApp();
  app.listen(PORT, () => {
    console.info(`Server is running on port ${PORT}`);
  });
}

main();
