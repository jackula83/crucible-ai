import { beforeEach, describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../../core/errors.js';
import { clearRegistryForTesting, register, resolve } from '../registry.js';
import { makeFakeAdapter } from './fake-adapter.js';

describe('provider registry', () => {
  beforeEach(() => {
    clearRegistryForTesting();
  });

  it('resolves a registered adapter as the same singleton instance', () => {
    const adapter = makeFakeAdapter();
    register('fake', adapter);
    expect(resolve('fake')).toBe(adapter);
    expect(resolve('fake')).toBe(resolve('fake'));
  });

  it('throws a config error for an unknown provider, naming the bad value', () => {
    register('fake', makeFakeAdapter());
    let caught: unknown;
    try {
      resolve('nope');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CrucibleError);
    const err = caught as CrucibleError;
    expect(err.kind).toBe('config');
    expect(err.message).toContain('nope');
  });

  it('lists the registered providers in the unknown-provider error', () => {
    register('fake', makeFakeAdapter('fake'));
    register('other', makeFakeAdapter('other'));
    expect(() => resolve('nope')).toThrow(/fake/);
    expect(() => resolve('nope')).toThrow(/other/);
  });

  it('reports when no providers are registered at all', () => {
    expect(() => resolve('anything')).toThrow(CrucibleError);
    expect(() => resolve('anything')).toThrow(/no providers/i);
  });

  it('rejects a duplicate registration under the same name', () => {
    register('fake', makeFakeAdapter('fake'));
    expect(() => register('fake', makeFakeAdapter('fake'))).toThrow(CrucibleError);
    expect(() => register('fake', makeFakeAdapter('fake'))).toThrow(/already registered/i);
  });

  it('rejects a registration whose name differs from adapter.name', () => {
    let caught: unknown;
    try {
      register('mismatch', makeFakeAdapter('fake'));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CrucibleError);
    expect((caught as CrucibleError).kind).toBe('usage');
  });

  it('the fake adapter conforms to the port spec (contract check)', async () => {
    const adapter = makeFakeAdapter();
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.envVar).toBe('string');
    const result = await adapter.complete(
      { model: 'test-model', prompt: 'hello' },
      new AbortController().signal,
    );
    expect(typeof result).toBe('string');
    expect(['retryable', 'fatal']).toContain(adapter.classifyFailure(new Error('boom')));
  });
});
