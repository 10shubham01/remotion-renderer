import winston from "winston";
import WinstonCloudWatch from "winston-cloudwatch";
import fetch from "node-fetch";

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

const logs: string[] = [];

function postToWebhooks(logEntry: string, webhooks: Set<string>) {
  for (const url of webhooks) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log: logEntry }),
    }).catch(() => {});
  }
}

function log(message: string, webhooks: Set<string>) {
  const entry = `[${new Date().toISOString()}] ${message}`;
  logs.push(entry);
  logger.info(message);
  postToWebhooks(entry, webhooks);
}

function logError(message: string, webhooks: Set<string>) {
  const entry = `[${new Date().toISOString()}] ERROR: ${message}`;
  logs.push(entry);
  logger.error(message);
  postToWebhooks(entry, webhooks);
}

function getLogs() {
  return logs.slice();
}

export { log, logError, getLogs, logger }; 