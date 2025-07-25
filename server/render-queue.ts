import {
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { randomUUID } from "node:crypto";
import path from "node:path";

interface JobData {
  titleText: string;
  compositionId: string;
  serveUrl: string;
}

type JobState =
  | {
      status: "queued";
      data: JobData;
      cancel: () => void;
    }
  | {
      status: "in-progress";
      progress: number;
      data: JobData;
      cancel: () => void;
    }
  | {
      status: "completed";
      videoUrl: string;
      data: JobData;
    }
  | {
      status: "failed";
      error: Error;
      data: JobData;
    };

// Centralized in-memory log buffer
const LOG_BUFFER_SIZE = 200;
const logs: string[] = [];
function log(message: string) {
  const entry = `[${new Date().toISOString()}] ${message}`;
  logs.push(entry);
  if (logs.length > LOG_BUFFER_SIZE) logs.shift();
  console.info(entry);
}
function logError(message: string) {
  const entry = `[${new Date().toISOString()}] ERROR: ${message}`;
  logs.push(entry);
  if (logs.length > LOG_BUFFER_SIZE) logs.shift();
  console.error(entry);
}
export function getLogs() {
  return logs.slice();
}

export const makeRenderQueue = ({
  port,
  rendersDir,
}: {
  port: number;
  rendersDir: string;
}) => {
  const jobs = new Map<string, JobState>();
  let queue: Promise<unknown> = Promise.resolve();

  const processRender = async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) {
      throw new Error(`Render job ${jobId} not found`);
    }

    const { cancel, cancelSignal } = makeCancelSignal();

    jobs.set(jobId, {
      progress: 0,
      status: "in-progress",
      cancel: cancel,
      data: job.data,
    });

    try {
      const inputProps = {
        titleText: job.data.titleText,
      };

      const composition = await selectComposition({
        serveUrl: job.data.serveUrl,
        id: job.data.compositionId,
        inputProps,
      });

      await renderMedia({
        cancelSignal,
        serveUrl: job.data.serveUrl,
        composition,
        inputProps,
        codec: "h264",
        onProgress: (progress) => {
          log(`${jobId} render progress: ${progress.progress}`);
          jobs.set(jobId, {
            progress: progress.progress,
            status: "in-progress",
            cancel: cancel,
            data: job.data,
          });
        },
        outputLocation: path.join(rendersDir, `${jobId}.mp4`),
      });

      jobs.set(jobId, {
        status: "completed",
        videoUrl: `http://localhost:${port}/renders/${jobId}.mp4`,
        data: job.data,
      });
      log(`${jobId} render completed.`);
    } catch (error) {
      logError(`${jobId} render failed: ${(error as Error).message}`);
      jobs.set(jobId, {
        status: "failed",
        error: error as Error,
        data: job.data,
      });
    }
  };

  const queueRender = async ({
    jobId,
    data,
  }: {
    jobId: string;
    data: JobData;
  }) => {
    jobs.set(jobId, {
      status: "queued",
      data,
      cancel: () => {
        jobs.delete(jobId);
        log(`${jobId} render cancelled.`);
      },
    });

    queue = queue.then(() => processRender(jobId));
    log(`${jobId} render queued.`);
  };

  function createJob(data: JobData) {
    const jobId = randomUUID();
    queueRender({ jobId, data });
    return jobId;
  }

  return {
    createJob,
    jobs,
  };
};
