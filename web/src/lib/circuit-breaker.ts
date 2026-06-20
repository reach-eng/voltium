export class CircuitBreakerError extends Error {
  public readonly service: string;
  public readonly state: string;
  public readonly lastError?: Error;

  constructor(message: string, service: string, state: string, lastError?: Error) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.service = service;
    this.state = state;
    this.lastError = lastError;
  }
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxRequests: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30_000,
  halfOpenMaxRequests: 3,
};

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenRequests = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(
    public readonly serviceName: string,
    options?: Partial<CircuitBreakerOptions>
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  getState(): CircuitState {
    if (
      this.state === 'OPEN' &&
      Date.now() - this.lastFailureTime >= this.options.recoveryTimeoutMs
    ) {
      this.state = 'HALF_OPEN';
      this.halfOpenRequests = 0;
      this.successCount = 0;
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerError(
        `Circuit breaker is OPEN for service "${this.serviceName}"`,
        this.serviceName,
        this.state
      );
    }

    if (currentState === 'HALF_OPEN' && this.halfOpenRequests >= this.options.halfOpenMaxRequests) {
      throw new CircuitBreakerError(
        `Circuit breaker HALF_OPEN max requests reached for service "${this.serviceName}"`,
        this.serviceName,
        this.state
      );
    }

    if (currentState === 'HALF_OPEN') {
      this.halfOpenRequests++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenMaxRequests) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.halfOpenRequests = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      return;
    }

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenRequests = 0;
    this.lastFailureTime = 0;
  }

  getStats() {
    return {
      serviceName: this.serviceName,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenRequests: this.halfOpenRequests,
      options: this.options,
    };
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  serviceName: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  if (!breakers.has(serviceName)) {
    breakers.set(serviceName, new CircuitBreaker(serviceName, options));
  }
  return breakers.get(serviceName)!;
}

export const smsBreaker = getCircuitBreaker('sms-provider', {
  failureThreshold: 3,
  recoveryTimeoutMs: 60_000,
  halfOpenMaxRequests: 2,
});

export const firebaseAuthBreaker = getCircuitBreaker('firebase-auth', {
  failureThreshold: 5,
  recoveryTimeoutMs: 30_000,
  halfOpenMaxRequests: 3,
});

export const storageBreaker = getCircuitBreaker('storage-provider', {
  failureThreshold: 5,
  recoveryTimeoutMs: 45_000,
  halfOpenMaxRequests: 2,
});

export function getAllCircuitBreakers() {
  const stats: ReturnType<CircuitBreaker['getStats']>[] = [];
  for (const breaker of breakers.values()) {
    stats.push(breaker.getStats());
  }
  return stats;
}

export { CircuitBreaker };
export type { CircuitState, CircuitBreakerOptions };
