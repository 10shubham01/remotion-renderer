import { z } from "zod";

export const RenderJobSchema = z.object({
  titleText: z.string().optional().default("Hello, world!"),
  compositionId: z.string().min(1),
  serveUrl: z.string().url(),
});

export const WebhookSchema = z.object({
  url: z.string().url(),
});

export function validateRenderJob(data: unknown) {
  return RenderJobSchema.parse(data);
}

export function validateWebhook(data: unknown) {
  return WebhookSchema.parse(data);
} 