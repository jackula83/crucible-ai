import { describe, expect, it } from '@jest/globals';
import { FakeAdapter } from './test/adapter.fake.js';
import { RegistryHarness } from './test/registry-harness.util.js';
import { TestModel } from './test/test-model.enum.js';
import { providerRegistry, ProviderRegistry } from './registry.js';

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
    expect(RegistryHarness.errorKind(() => registry.resolve('nope'))).toBe('config');
  });

  it('registering the same provider twice is a usage failure', () => {
    const registry = new ProviderRegistry();
    registry.register('fake', new FakeAdapter('fake'));
    expect(
      RegistryHarness.errorKind(() => registry.register('fake', new FakeAdapter('fake'))),
    ).toBe('usage');
  });

  it('registering under a name that differs from the adapter is a usage failure', () => {
    const registry = new ProviderRegistry();
    expect(
      RegistryHarness.errorKind(() => registry.register('mismatch', new FakeAdapter('fake'))),
    ).toBe('usage');
  });
});

describe('default provider registry', () => {
  it('resolves the built-in openrouter provider without user wiring', () => {
    const adapter = providerRegistry.resolve('openrouter');
    expect(providerRegistry.resolve('openrouter')).toBe(adapter);
  });
});

describe('FakeAdapter port contract', () => {
  it('completes a request with a deterministic response', async () => {
    const response = await new FakeAdapter().complete(
      { model: TestModel.Generic, prompt: 'hello' },
      new AbortController().signal,
    );
    expect(response).toBe(`fake:${TestModel.Generic}:hello`);
  });

  it('rejects when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new FakeAdapter().complete({ model: TestModel.Generic, prompt: 'p' }, controller.signal),
    ).rejects.toBeInstanceOf(Error);
  });

  it('classifies retry-worthy failures as retryable and the rest as fatal', () => {
    const adapter = new FakeAdapter();
    expect(adapter.classifyFailure(new Error('please retry later'))).toBe('retryable');
    expect(adapter.classifyFailure(new Error('unauthorized'))).toBe('fatal');
  });
});
