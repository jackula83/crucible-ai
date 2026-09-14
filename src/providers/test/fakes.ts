import type { CompletionRequest, FailureClass, ProviderAdapter } from '../types.js';
import type { ProviderHttpRequestInit, ProviderHttpResponse } from '../openrouter.js';

enum TestModel {
  Gpt5 = 'openai/gpt-5',
  DeepseekV3 = 'deepseek-v3',
  Generic = 'test-model',
}

const TEST_API_KEY = 'sk-or-test';

class FakeAdapter implements ProviderAdapter {
  envVar = 'FAKE_API_KEY';

  constructor(public name: string = 'fake') {}

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

type CapturedCall = {
  url: string;
  init: ProviderHttpRequestInit;
};

class FakeFetchBoundary {
  calls: CapturedCall[] = [];

  constructor(private respond: () => Promise<ProviderHttpResponse>) {}

  fetchLike = (url: string, init: ProviderHttpRequestInit): Promise<ProviderHttpResponse> => {
    this.calls.push({ url, init });
    if (init.signal.aborted) {
      return Promise.reject(
        init.signal.reason instanceof Error ? init.signal.reason : new Error('aborted'),
      );
    }
    return this.respond();
  };
}

const jsonResponse = (status: number, envelope: unknown): (() => Promise<ProviderHttpResponse>) => {
  return () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(envelope),
    });
};

const successEnvelope = (text: string): unknown => {
  return { choices: [{ message: { content: text } }] };
};

export { FakeAdapter, FakeFetchBoundary, jsonResponse, successEnvelope, TestModel, TEST_API_KEY };
export type { CapturedCall };
