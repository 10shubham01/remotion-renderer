import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";
import rendersRouter from "./routes/renders";
import logsRouter from "./routes/logs";
import webhookRouter from "./routes/webhook";
import { requestLogger } from "./middleware/requestLogger";
import { rateLimiter } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";

const { PORT = 8989 } = process.env;

function setupApp() {
  const app = express();
  const rendersDir = path.resolve("renders");
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(rateLimiter);
  app.get("/health", (_, res) => res.json({ status: "ok" }));
  app.use("/renders", express.static(rendersDir));
  app.use("/renders", rendersRouter);
  app.use("/logs", logsRouter);
  app.use("/webhook-logs", webhookRouter);
  app.use(errorHandler);
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
