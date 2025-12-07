// lib/orchestrator/error-handling.ts
// Error handling, fallback patterns, rate limiting, and circuit breaker

interface FallbackConfig {
  primary: string;
  fallbacks: string[];
  maxRetries: number;
}

const providerFallbacks: Record<string, FallbackConfig> = {
  text: {
    primary: 'openai:gpt-4o',
    fallbacks: ['google:gemini-2.0-flash-exp', 'kimi:moonshot-v1-128k'],
    maxRetries: 2,
  },
  image: {
    primary: 'wavespeed:flux-dev',
    fallbacks: ['wavespeed:flux-schnell', 'openai:dall-e-3'],
    maxRetries: 2,
  },
  video: {
    primary: 'minimax:video-01',
    fallbacks: ['wavespeed:wan-2.1-t2v-720p', 'wavespeed:wan-2.1-t2v-480p'],
    maxRetries: 2,
  },
};

/**
 * Execute a task with automatic fallback to alternative providers on failure
 */
export async function executeWithFallback<T>(
  taskType: keyof typeof providerFallbacks,
  executor: (providerId: string) => Promise<T>,
  onFallback?: (error: Error, nextProvider: string) => void
): Promise<{ result: T; provider: string }> {
  const config = providerFallbacks[taskType];
  const providers = [config.primary, ...config.fallbacks];

  for (const provider of providers) {
    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        const result = await executor(provider);
        return { result, provider };
      } catch (error) {
        const err = error as Error;
        const isRetryable =
          err.message.includes('429') || // Rate limit
          err.message.includes('503') || // Service unavailable
          err.message.includes('timeout');

        if (isRetryable && attempt < config.maxRetries - 1) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }

        // Move to next provider
        const nextProviderIndex = providers.indexOf(provider) + 1;
        if (nextProviderIndex < providers.length) {
          onFallback?.(err, providers[nextProviderIndex]);
          break; // Exit retry loop, try next provider
        }
      }
    }
  }

  throw new Error(`All providers failed for ${taskType}`);
}

/**
 * Rate-limited request queue to prevent hitting API limits
 */
export class RateLimitedQueue {
  private queues = new Map<string, Promise<void>>();
  private limits: Record<string, { rpm: number; lastRequest: number }> = {
    'openai': { rpm: 500, lastRequest: 0 },
    'google': { rpm: 1000, lastRequest: 0 },
    'kimi': { rpm: 60, lastRequest: 0 },
    'wavespeed': { rpm: 500, lastRequest: 0 },
    'minimax': { rpm: 60, lastRequest: 0 },
  };

  async enqueue<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    const providerKey = provider.split(':')[0]; // Extract provider name
    const limit = this.limits[providerKey];

    if (!limit) {
      // No rate limit configured, execute immediately
      return fn();
    }

    const minInterval = 60000 / limit.rpm;
    const timeSinceLastRequest = Date.now() - limit.lastRequest;

    if (timeSinceLastRequest < minInterval) {
      await new Promise(r => setTimeout(r, minInterval - timeSinceLastRequest));
    }

    limit.lastRequest = Date.now();
    return fn();
  }

  /**
   * Update rate limits dynamically (e.g., based on API tier)
   */
  setLimit(provider: string, rpm: number): void {
    this.limits[provider] = {
      rpm,
      lastRequest: this.limits[provider]?.lastRequest ?? 0,
    };
  }

  /**
   * Get current rate limit info
   */
  getLimit(provider: string): { rpm: number; lastRequest: number } | undefined {
    return this.limits[provider];
  }
}

/**
 * Circuit breaker to prevent cascade failures
 */
export class CircuitBreaker {
  private failures = new Map<string, number>();
  private openUntil = new Map<string, number>();
  private readonly threshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  /**
   * Check if circuit is open (provider is temporarily blocked)
   */
  isOpen(provider: string): boolean {
    const openUntil = this.openUntil.get(provider);
    if (openUntil && Date.now() < openUntil) {
      return true;
    }
    if (openUntil) {
      // Circuit has cooled down, reset
      this.openUntil.delete(provider);
      this.failures.set(provider, 0);
    }
    return false;
  }

  /**
   * Record a successful request
   */
  recordSuccess(provider: string): void {
    this.failures.set(provider, 0);
  }

  /**
   * Record a failed request
   */
  recordFailure(provider: string): void {
    const current = (this.failures.get(provider) ?? 0) + 1;
    this.failures.set(provider, current);

    if (current >= this.threshold) {
      // Open circuit
      this.openUntil.set(provider, Date.now() + this.resetTimeout);
    }
  }

  /**
   * Get current failure count
   */
  getFailureCount(provider: string): number {
    return this.failures.get(provider) ?? 0;
  }

  /**
   * Manually reset a provider
   */
  reset(provider: string): void {
    this.failures.delete(provider);
    this.openUntil.delete(provider);
  }

  /**
   * Get all provider statuses
   */
  getStatus(): Record<string, { failures: number; isOpen: boolean; opensAt?: number }> {
    const status: Record<string, { failures: number; isOpen: boolean; opensAt?: number }> = {};

    for (const [provider, failures] of this.failures) {
      status[provider] = {
        failures,
        isOpen: this.isOpen(provider),
        opensAt: this.openUntil.get(provider),
      };
    }

    return status;
  }
}

/**
 * Create a singleton instances for global use
 */
export const globalRateLimiter = new RateLimitedQueue();
export const globalCircuitBreaker = new CircuitBreaker();

/**
 * Wrapper that combines rate limiting, circuit breaking, and fallback
 */
export async function executeWithProtection<T>(
  taskType: keyof typeof providerFallbacks,
  executor: (providerId: string) => Promise<T>,
  options?: {
    onFallback?: (error: Error, nextProvider: string) => void;
    skipRateLimit?: boolean;
    skipCircuitBreaker?: boolean;
  }
): Promise<{ result: T; provider: string }> {
  return executeWithFallback(
    taskType,
    async (providerId: string) => {
      // Check circuit breaker
      if (!options?.skipCircuitBreaker && globalCircuitBreaker.isOpen(providerId)) {
        throw new Error(`Circuit breaker open for ${providerId}`);
      }

      try {
        // Apply rate limiting
        const result = options?.skipRateLimit
          ? await executor(providerId)
          : await globalRateLimiter.enqueue(providerId, () => executor(providerId));

        // Record success
        if (!options?.skipCircuitBreaker) {
          globalCircuitBreaker.recordSuccess(providerId);
        }

        return result;
      } catch (error) {
        // Record failure
        if (!options?.skipCircuitBreaker) {
          globalCircuitBreaker.recordFailure(providerId);
        }
        throw error;
      }
    },
    options?.onFallback
  );
}
