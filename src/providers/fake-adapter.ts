import type { CompletionRequest, FailureClass, ProviderAdapter } from './types.js';

class FakeAdapter implements ProviderAdapter {
  readonly envVar = 'FAKE_API_KEY';

  constructor(readonly name: string = 'fake') {}

  complete(request: CompletionRequest, signal: AbortSignal): Promise<string> {
    if (signal.aborted) {
      return Promise.reject(
        signal.reason instanceof Error ? signal.reason : new Error('aborted'),
      );
    }
    return Promise.resolve(`fake:${request.model}:${request.prompt}`);
  }

  classifyFailure(error: unknown): FailureClass {
    return error instanceof Error && error.message.includes('retry') ? 'retryable' : 'fatal';
  }
}

export { FakeAdapter };
