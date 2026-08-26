/**
 * PostHog rate limiter — free tier safety valve.
 *
 * The PostHog Cloud free tier is limited to 1M events/month. If the
 * Voltium app ever gets a traffic spike (e.g. viral referral, push
 * notification blast), we could blow through the budget in a day and
 * either get throttled or hit the paywall. This rate limiter drops
 * events when a monthly budget counter is exceeded.
 *
 * Design:
 *   - In-memory counter, resets at the start of each calendar month
 *   - Configurable monthly cap (default 800k = 80% of 1M free tier)
 *   - When the cap is hit, new events are dropped silently (not
 *     queued, not retried)
 *   - The counter is reset by a `reset()` call, which is called by
 *     the PostHogService on app startup (so a fresh process starts
 *     with a fresh count) and by an optional periodic timer
 *   - This is NOT an opt-out flag for users; it's a server-side
 *     safety valve to prevent bill shock. Users cannot disable it.
 *
 * Tradeoffs:
 *   - In-memory means the count is per-process. In a multi-instance
 *     deployment, the actual event count could be N * cap. For the
 *     Voltium single-instance deployment this is fine.
 *   - The cap is enforced at the application layer, not the PostHog
 *     layer. If the app is bypassed (e.g. direct API calls), the cap
 *     doesn't apply.
 */
export class PostHogRateLimiter {
  private count = 0;
  private currentMonth: string;

  constructor(
    private readonly monthlyCap: number = 800_000,
  ) {
    this.currentMonth = this.getCurrentMonth();
  }

  /**
   * Check if an event is allowed under the monthly cap. If allowed,
   * increments the counter and returns true. If the cap is hit,
   * returns false (event should be dropped).
   */
  public tryConsume(): boolean {
    this.maybeReset();
    if (this.count >= this.monthlyCap) {
      return false;
    }
    this.count++;
    return true;
  }

  /**
   * Current count for observability. Useful for /api/metrics or
   * admin dashboards.
   */
  public getCount(): number {
    this.maybeReset();
    return this.count;
  }

  /**
   * Reset the counter. Called on app startup.
   */
  public reset(): void {
    this.count = 0;
    this.currentMonth = this.getCurrentMonth();
  }

  private maybeReset(): void {
    const month = this.getCurrentMonth();
    if (month !== this.currentMonth) {
      this.count = 0;
      this.currentMonth = month;
    }
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

// Singleton instance. Created lazily on first use.
let instance: PostHogRateLimiter | null = null;

export function getPostHogRateLimiter(): PostHogRateLimiter {
  if (!instance) {
    instance = new PostHogRateLimiter(
      parseInt(process.env.POSTHOG_MONTHLY_CAP || '800000', 10),
    );
  }
  return instance;
}
