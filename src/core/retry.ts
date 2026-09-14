import type { CompletionRequest, ProviderAdapter } from '../providers/types.js';
import { CrucibleError } from './errors.js';

const MAX_ATTEMPTS = 3;

type Sleep = (ms: number) => Promise<void>;

type BackoffPolicy = {
  readonly baseDelayMs?: number;
  readonly jitter?: () => number;
};

class RetryingCompleter {
  private readonly baseDelayMs: number;
  private readonly jitter: () => number;

  private static defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  constructor(
    private readonly sleep: Sleep = RetryingCompleter.defaultSleep,
    backoff: BackoffPolicy = {},
  ) {
    this.baseDelayMs = Math.max(1, backoff.baseDelayMs ?? 250);
    this.jitter = backoff.jitter ?? Math.random;
  }

  async complete(
    adapter: ProviderAdapter,
    request: CompletionRequest,
    signal: AbortSignal,
  ): Promise<string> {
    let lastError: unknown;
    for (let retriesUsed = 0; retriesUsed < MAX_ATTEMPTS; retriesUsed += 1) {
      this.throwIfAborted(signal);
      try {
        return await adapter.complete(request, signal);
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        lastError = this.rethrowUnlessRetryable(adapter, error);
        if (retriesUsed < MAX_ATTEMPTS - 1) {
          await this.sleep(this.delayForRetry(retriesUsed + 1));
        }
      }
    }
    throw new CrucibleError(
      'infra',
      `Provider "${adapter.name}" kept failing after ${MAX_ATTEMPTS} attempts.`,
      { retryable: true, cause: lastError },
    );
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error('aborted');
    }
  }

  private rethrowUnlessRetryable(adapter: ProviderAdapter, error: unknown): unknown {
    if (error instanceof CrucibleError) {
      if (error.kind === 'infra' && error.retryable === true) {
        return error;
      }
      throw error;
    }
    if (adapter.classifyFailure(error) === 'fatal') {
      throw new CrucibleError('infra', `Provider "${adapter.name}" failed fatally.`, {
        retryable: false,
        cause: error,
      });
    }
    return error;
  }

  private delayForRetry(retryNumber: number): number {
    return Math.max(0, this.baseDelayMs * 2 ** (retryNumber - 1) * (1 + this.jitter()));
  }
}

export { RetryingCompleter };
export type { BackoffPolicy, Sleep };
