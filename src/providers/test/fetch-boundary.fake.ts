import type { ProviderHttpRequestInit, ProviderHttpResponse } from '../openrouter.js';

class FakeFetchBoundary {
  constructor(private respond: () => Promise<ProviderHttpResponse>) {}

  fetchLike = (_url: string, init: ProviderHttpRequestInit): Promise<ProviderHttpResponse> => {
    if (init.signal.aborted) {
      return Promise.reject(
        init.signal.reason instanceof Error ? init.signal.reason : new Error('aborted'),
      );
    }
    return this.respond();
  };

  static respondingWith(status: number, envelope: unknown): FakeFetchBoundary {
    return new FakeFetchBoundary(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(envelope),
      }),
    );
  }

  static failing(error: Error): FakeFetchBoundary {
    return new FakeFetchBoundary(() => Promise.reject(error));
  }

  static withUnparseableBody(): FakeFetchBoundary {
    return new FakeFetchBoundary(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('bad json')),
      }),
    );
  }

  static successEnvelope(text: string): unknown {
    return { choices: [{ message: { content: text } }] };
  }
}

export { FakeFetchBoundary };
