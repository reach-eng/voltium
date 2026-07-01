import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

if (process.env.POSTHOG_API_KEY) {
  posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    flushAt: 1,
    flushInterval: 0, // For serverless environments like Next.js API routes
  });
}

const PII_KEYS = ['phone', 'email', 'otp', 'aadhaar', 'pan', 'password', 'token'];

function scrubProperties(properties?: Record<string, any>): Record<string, any> | undefined {
  if (!properties) return undefined;
  
  const scrubbed = { ...properties };
  for (const key of Object.keys(scrubbed)) {
    if (PII_KEYS.some(pii => key.toLowerCase().includes(pii))) {
      scrubbed[key] = '[SCRUBBED]';
    } else if (typeof scrubbed[key] === 'object' && scrubbed[key] !== null) {
      scrubbed[key] = scrubProperties(scrubbed[key]);
    }
  }
  return scrubbed;
}

export const posthog = {
  capture(event: string, properties?: Record<string, any>, distinctId: string = 'anonymous') {
    if (!posthogClient) return;
    posthogClient.capture({
      distinctId,
      event,
      properties: scrubProperties(properties),
    });
  },
  
  identify(distinctId: string, properties?: Record<string, any>) {
    if (!posthogClient) return;
    posthogClient.identify({
      distinctId,
      properties: scrubProperties(properties),
    });
  },

  async shutdown() {
    if (posthogClient) {
      await posthogClient.shutdown();
    }
  }
};
