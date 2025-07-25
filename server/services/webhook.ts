const webhooks: Set<string> = new Set();

export function registerWebhook(url: string) {
  webhooks.add(url);
}

export function unregisterWebhook(url: string) {
  webhooks.delete(url);
}

export function getWebhooks() {
  return webhooks;
} 