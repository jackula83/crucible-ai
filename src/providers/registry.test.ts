import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { FakeAdapter } from './fake-adapter.js';
import { ProviderRegistry } from './registry.js';

function getError(fn: () => unknown): CrucibleError {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(CrucibleError);
  return caught as CrucibleError;
}

describe('ProviderRegistry', () => {
  it('resolves a registered adapter as the same singleton every time', () => {
    const registry = new ProviderRegistry();
    const adapter = new FakeAdapter();
    registry.register('fake', adapter);
    expect(registry.resolve('fake')).toBe(adapter);
    expect(registry.resolve('fake')).toBe(registry.resolve('fake'));
  });

  it('resolving an unregistered provider is a config failure', () => {
    const registry = new ProviderRegistry();
    registry.register('fake', new FakeAdapter());
    expect(getError(() => registry.resolve('nope')).kind).toBe('config');
  });

  it('registering the same provider twice is a usage failure', () => {
    const registry = new ProviderRegistry();
    registry.register('fake', new FakeAdapter('fake'));
    expect(getError(() => registry.register('fake', new FakeAdapter('fake'))).kind).toBe('usage');
  });

  it('registering under a name that differs from the adapter is a usage failure', () => {
    const registry = new ProviderRegistry();
    expect(getError(() => registry.register('mismatch', new FakeAdapter('fake'))).kind).toBe(
      'usage',
    );
  });
});

describe('FakeAdapter port contract', () => {
  it('completes a request with a deterministic response', async () => {
    const response = await new FakeAdapter().complete(
      { model: 'test-model', prompt: 'hello' },
      new AbortController().signal,
    );
    expect(response).toBe('fake:test-model:hello');
  });

  it('rejects when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new FakeAdapter().complete({ model: 'm', prompt: 'p' }, controller.signal),
    ).rejects.toBeInstanceOf(Error);
  });

  it('classifies retry-worthy failures as retryable and the rest as fatal', () => {
    const adapter = new FakeAdapter();
    expect(adapter.classifyFailure(new Error('please retry later'))).toBe('retryable');
    expect(adapter.classifyFailure(new Error('unauthorized'))).toBe('fatal');
  });
});
