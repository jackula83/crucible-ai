import { describe, expect, it } from '@jest/globals';
import type { CompletionRequest, ProviderAdapter } from '../providers/types.js';
import { TestModel } from '../providers/test/fakes.js';
import { CrucibleError } from './errors.js';
import { RetryingCompleter } from './retry.js';
import { ScriptedAdapter, SleepRecorder } from './test/fakes.js';

const request: CompletionRequest = { model: TestModel.Generic, prompt: 'p' };

const run = (adapter: ProviderAdapter, recorder: SleepRecorder): Promise<string> => {
  return new RetryingCompleter(recorder.sleep).complete(
    adapter,
    request,
    new AbortController().signal,
  );
};

const failureFrom = async (promise: Promise<string>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the retrier to reject');
};

describe('RetryingCompleter', () => {
  it('resolves a first-attempt success with no sleeping', async () => {
    const adapter = new ScriptedAdapter([{ resolve: 'verdict' }], 'retryable');
    const recorder = new SleepRecorder();
    await expect(run(adapter, recorder)).resolves.toBe('verdict');
    expect(adapter.calls).toBe(1);
    expect(recorder.waits).toHaveLength(0);
  });

  it('retries a retryable failure after awaiting the injected sleep and resolves the next success', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('flake') }, { resolve: 'verdict' }],
      'retryable',
    );
    const recorder = new SleepRecorder();
    await expect(run(adapter, recorder)).resolves.toBe('verdict');
    expect(adapter.calls).toBe(2);
    expect(recorder.waits).toHaveLength(1);
    expect(recorder.waits[0]).toBeGreaterThan(0);
  });

  it('exhausts after three retryable failures with a retryable infra error carrying the last cause', async () => {
    const lastError = new Error('third flake');
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('first') }, { reject: new Error('second') }, { reject: lastError }],
      'retryable',
    );
    const recorder = new SleepRecorder();
    const error = await failureFrom(run(adapter, recorder));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
    expect((error as CrucibleError).cause).toBe(lastError);
    expect(adapter.calls).toBe(3);
    expect(recorder.waits).toHaveLength(2);
  });

  it('short-circuits a fatal failure into a non-retryable infra error with one call and no sleep', async () => {
    const cause = new Error('unauthorized');
    const adapter = new ScriptedAdapter([{ reject: cause }], 'fatal');
    const recorder = new SleepRecorder();
    const error = await failureFrom(run(adapter, recorder));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(false);
    expect((error as CrucibleError).cause).toBe(cause);
    expect(adapter.calls).toBe(1);
    expect(recorder.waits).toHaveLength(0);
  });

  it('propagates an abort rejection as-is without retrying or sleeping', async () => {
    const reason = new Error('caller gave up');
    const adapter = new ScriptedAdapter([], 'retryable');
    const recorder = new SleepRecorder();
    const controller = new AbortController();
    controller.abort(reason);
    const rejection = new RetryingCompleter(recorder.sleep).complete(
      adapter,
      request,
      controller.signal,
    );
    await expect(rejection).rejects.toBe(reason);
    expect(recorder.waits).toHaveLength(0);
    expect(adapter.calls).toBe(0);
  });

  it('rethrows a fatal crucible error unchanged so its kind survives', async () => {
    const configError = new CrucibleError('config', 'set the key');
    const adapter = new ScriptedAdapter([{ reject: configError }], 'fatal');
    const recorder = new SleepRecorder();
    const error = await failureFrom(run(adapter, recorder));
    expect(error).toBe(configError);
    expect((error as CrucibleError).kind).toBe('config');
    expect(adapter.calls).toBe(1);
    expect(recorder.waits).toHaveLength(0);
  });

  it('retries a crucible infra error marked retryable instead of rethrowing it', async () => {
    const flake = new CrucibleError('infra', 'transient', { retryable: true });
    const adapter = new ScriptedAdapter([{ reject: flake }, { resolve: 'verdict' }], 'fatal');
    const recorder = new SleepRecorder();
    await expect(run(adapter, recorder)).resolves.toBe('verdict');
    expect(adapter.calls).toBe(2);
  });

  it('stops retrying when the signal aborts during the backoff sleep', async () => {
    const reason = new Error('caller gave up mid-backoff');
    const controller = new AbortController();
    const adapter = new ScriptedAdapter([{ reject: new Error('flake') }], 'retryable');
    const abortingSleep = (): Promise<void> => {
      controller.abort(reason);
      return Promise.resolve();
    };
    const rejection = new RetryingCompleter(abortingSleep).complete(
      adapter,
      request,
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
    const completer = new RetryingCompleter(recorder.sleep, {
      baseDelayMs: 100,
      jitter: () => -5,
    });
    await expect(
      completer.complete(adapter, request, new AbortController().signal),
    ).resolves.toBe('verdict');
    expect(recorder.waits[0]).toBeGreaterThanOrEqual(0);
  });

  it('sleeps between every pair of retryable attempts, not after the last one', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('one') }, { reject: new Error('two') }, { resolve: 'verdict' }],
      'retryable',
    );
    const recorder = new SleepRecorder();
    await expect(run(adapter, recorder)).resolves.toBe('verdict');
    expect(adapter.calls).toBe(3);
    expect(recorder.waits).toHaveLength(2);
  });
});
