import type { CompletionRequest, ProviderAdapter } from '../../providers/types.js';
import { TestModel } from '../../providers/test/test-model.enum.js';
import { RetryingCompleter } from '../retry.js';
import { Capture } from './capture.util.js';
import { SleepRecorder } from './sleep-recorder.fake.js';

class RetryHarness {
  static request: CompletionRequest = { model: TestModel.Generic, prompt: 'p' };

  static run(
    adapter: ProviderAdapter,
    recorder: SleepRecorder = new SleepRecorder(),
  ): Promise<string> {
    return new RetryingCompleter(recorder.sleep).complete(
      adapter,
      RetryHarness.request,
      new AbortController().signal,
    );
  }

  static failure(adapter: ProviderAdapter): Promise<unknown> {
    return Capture.rejection(RetryHarness.run(adapter));
  }
}

export { RetryHarness };
