import { describe, expect, it } from '@jest/globals';
import type { CompletionRequest, ProviderAdapter } from '../providers/types.js';
import { TestModel } from '../providers/test/test-model.enum.js';
import { CrucibleError } from './errors.js';
import { RetryingCompleter } from './retry.js';
import { Capture } from './test/capture.harness.js';
import { ScriptedAdapter } from './test/scripted-adapter.fake.js';
import { SleepRecorder } from './test/sleep-recorder.fake.js';

class Harness {
  static request: CompletionRequest = { model: TestModel.Generic, prompt: 'p' };

  static run(adapter: ProviderAdapter, recorder: SleepRecorder = new SleepRecorder()): Promise<string> {
    return new RetryingCompleter(recorder.sleep).complete(
      adapter,
      Harness.request,
      new AbortController().signal,
    );
  }

  static failure(adapter: ProviderAdapter): Promise<unknown> {
    return Capture.rejection(Harness.run(adapter));
  }
}

describe('RetryingCompleter', () => {
  it('resolves a first-attempt success', async () => {
    const adapter = new ScriptedAdapter([{ resolve: 'verdict' }], 'retryable');
    await expect(Harness.run(adapter)).resolves.toBe('verdict');
  });

  it('retries a retryable failure and resolves the next success', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('flake') }, { resolve: 'verdict' }],
      'retryable',
    );
    await expect(Harness.run(adapter)).resolves.toBe('verdict');
  });

  it('exhausts persistent retryable failures as a retryable infra error', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('first') }, { reject: new Error('second') }, { reject: new Error('third') }],
      'retryable',
    );
    const error = await Harness.failure(adapter);
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });

  it('surfaces a fatal failure as a non-retryable infra error without retrying', async () => {
    const adapter = new ScriptedAdapter([{ reject: new Error('unauthorized') }], 'fatal');
    const error = await Harness.failure(adapter);
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(false);
    expect(adapter.calls).toBe(1);
  });

  it('propagates an abort rejection as-is without attempting', async () => {
    const reason = new Error('caller gave up');
    const adapter = new ScriptedAdapter([], 'retryable');
    const controller = new AbortController();
    controller.abort(reason);
    const rejection = new RetryingCompleter(new SleepRecorder().sleep).complete(
      adapter,
      Harness.request,
      controller.signal,
    );
    await expect(rejection).rejects.toBe(reason);
  });

  it('rethrows a fatal crucible error unchanged so its kind survives', async () => {
    const configError = new CrucibleError('config', 'set the key');
    const adapter = new ScriptedAdapter([{ reject: configError }], 'fatal');
    const error = await Harness.failure(adapter);
    expect(error).toBe(configError);
  });

  it('retries a crucible infra error marked retryable instead of rethrowing it', async () => {
    const flake = new CrucibleError('infra', 'transient', { retryable: true });
    const adapter = new ScriptedAdapter([{ reject: flake }, { resolve: 'verdict' }], 'fatal');
    await expect(Harness.run(adapter)).resolves.toBe('verdict');
  });

  it('stops retrying when the signal aborts during the backoff wait', async () => {
    const reason = new Error('caller gave up mid-backoff');
    const controller = new AbortController();
    const adapter = new ScriptedAdapter([{ reject: new Error('flake') }], 'retryable');
    const abortingSleep = (): Promise<void> => {
      controller.abort(reason);
      return Promise.resolve();
    };
    const rejection = new RetryingCompleter(abortingSleep).complete(
      adapter,
      Harness.request,
      controller.signal,
    );
    await expect(rejection).rejects.toBe(reason);
    expect(adapter.calls).toBe(1);
  });

  it('never computes a negative backoff delay even with a hostile jitter source', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('one') }, { resolve: 'verdict' }],
      'retryable',
    );
    const recorder = new SleepRecorder();
    const completer = new RetryingCompleter(recorder.sleep, { baseDelayMs: 100, jitter: () => -5 });
    await expect(
      completer.complete(adapter, Harness.request, new AbortController().signal),
    ).resolves.toBe('verdict');
    expect(recorder.waits[0]).toBeGreaterThanOrEqual(0);
  });

  it('waits between retryable attempts, never after the final one', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('one') }, { reject: new Error('two') }, { resolve: 'verdict' }],
      'retryable',
    );
    const recorder = new SleepRecorder();
    await expect(Harness.run(adapter, recorder)).resolves.toBe('verdict');
    expect(recorder.waits).toHaveLength(2);
  });
});
