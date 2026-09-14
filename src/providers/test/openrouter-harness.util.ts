import { Capture } from '../../core/test/capture.util.js';
import { OpenRouterAdapter } from '../openrouter.js';
import { FakeFetchBoundary } from './fetch-boundary.fake.js';
import { TestModel } from './test-model.enum.js';

const TEST_API_KEY = 'sk-or-test';

class OpenRouterHarness {
  static judgePrompt = 'judge this';

  static adapter(
    boundary: FakeFetchBoundary,
    keyReader: () => string | undefined = () => TEST_API_KEY,
  ): OpenRouterAdapter {
    return new OpenRouterAdapter(boundary.fetchLike, keyReader);
  }

  static complete(adapter: OpenRouterAdapter): Promise<string> {
    return adapter.complete(
      { model: TestModel.Generic, prompt: OpenRouterHarness.judgePrompt },
      new AbortController().signal,
    );
  }

  static failure(adapter: OpenRouterAdapter): Promise<unknown> {
    return Capture.rejection(OpenRouterHarness.complete(adapter));
  }
}

export { OpenRouterHarness };
