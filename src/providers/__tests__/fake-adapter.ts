import type { CompletionRequest, FailureClass, ProviderAdapter } from '../types.js';

/**
 * Spec-conforming fake adapter for unit tests. Conforms exactly to the
 * provider port in src/providers/types.ts — the same contract Story 1.2's
 * real adapter implements. Never touches the network.
 */
export function makeFakeAdapter(name = 'fake'): ProviderAdapter {
  return {
    name,
    envVar: 'FAKE_API_KEY',
    complete(request: CompletionRequest, signal: AbortSignal): Promise<string> {
      if (signal.aborted) {
        return Promise.reject(new Error('aborted'));
      }
      return Promise.resolve(`fake:${request.model}:${request.prompt}`);
    },
    classifyFailure(error: unknown): FailureClass {
      return error instanceof Error && error.message.includes('retry') ? 'retryable' : 'fatal';
    },
  };
}
