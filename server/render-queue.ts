import { makeCancelSignal, renderMedia, selectComposition } from "@remotion/renderer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import winston from "winston";
import WinstonCloudWatch from "winston-cloudwatch";
import { webhookLogUrls } from "./index";
import fetch from "node-fetch";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

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
      s3Upload?: {
        attempted: boolean;
        success: boolean;
        url?: string;
        error?: string;
      };
      data: JobData;
    }
  | {
      status: "failed";
      error: Error;
      data: JobData;
    };

const cloudWatchConfig = {
  logGroupName: process.env.CLOUDWATCH_LOG_GROUP || "remotion-render-server-logs",
  logStreamName: process.env.CLOUDWATCH_LOG_STREAM || "default-stream",
};

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new WinstonCloudWatch(cloudWatchConfig),
  ],
});

console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
console.log('AWS_REGION:', process.env.AWS_REGION);

const logs: string[] = [];
function postToWebhooks(logEntry: string) {
  for (const url of webhookLogUrls) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log: logEntry }),
    }).catch(() => {});
  }
}
function log(message: string) {
  const entry = `[${new Date().toISOString()}] ${message}`;
  logs.push(entry);
  logger.info(message);
  postToWebhooks(entry);
}
function logError(message: string) {
  const entry = `[${new Date().toISOString()}] ERROR: ${message}`;
  logs.push(entry);
  logger.error(message);
  postToWebhooks(entry);
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
  const S3_BUCKET = process.env.S3_BUCKET;
  const S3_REQUIRED = process.env.S3_REQUIRED === "true";
  const s3 = S3_BUCKET ? new S3Client({}) : null;
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
      const outputPath = path.join(rendersDir, `${jobId}.mp4`);
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
        outputLocation: outputPath,
      });
      let videoUrl = `http://localhost:${port}/renders/${jobId}.mp4`;
      let s3Upload: undefined | { attempted: boolean; success: boolean; url?: string; error?: string } = undefined;
      if (s3 && S3_BUCKET) {
        try {
          const fileStream = fs.createReadStream(outputPath);
          const s3Key = `renders/${jobId}.mp4`;
          await s3.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: s3Key,
              Body: fileStream,
              ContentType: "video/mp4",
            })
          );
          videoUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
          log(`${jobId} uploaded to S3: ${videoUrl}`);
          s3Upload = { attempted: true, success: true, url: videoUrl };
        } catch (err) {
          logError(`${jobId} failed to upload to S3: ${(err as Error).message}`);
          s3Upload = { attempted: true, success: false, error: (err as Error).message };
          if (S3_REQUIRED) {
            throw new Error(`S3 upload required but failed: ${(err as Error).message}`);
          }
        }
      } else {
        const missingEnvs = [];
        if (!S3_BUCKET) missingEnvs.push('S3_BUCKET');
        if (!process.env.AWS_REGION) missingEnvs.push('AWS_REGION');
        if (!process.env.AWS_ACCESS_KEY_ID) missingEnvs.push('AWS_ACCESS_KEY_ID');
        if (!process.env.AWS_SECRET_ACCESS_KEY) missingEnvs.push('AWS_SECRET_ACCESS_KEY');
        log(`${jobId} S3 upload skipped: S3 config missing. Missing: ${missingEnvs.join(', ')}`);
        s3Upload = { attempted: false, success: false, error: `S3 config missing: ${missingEnvs.join(', ')}` };
        if (S3_REQUIRED) {
          throw new Error(`S3 upload required but S3 config missing: ${missingEnvs.join(', ')}`);
        }
      }
      jobs.set(jobId, {
        status: "completed",
        videoUrl,
        s3Upload,
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
