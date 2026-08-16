import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';

describe('CrucibleError', () => {
  it('carries the kind that callers branch on', () => {
    expect(new CrucibleError('config', 'm').kind).toBe('config');
    expect(new CrucibleError('usage', 'm').kind).toBe('usage');
    expect(new CrucibleError('infra', 'm').kind).toBe('infra');
  });

  it('infra failures are non-retryable unless marked retryable', () => {
    expect(new CrucibleError('infra', 'm').retryable).toBe(false);
    expect(new CrucibleError('infra', 'm', { retryable: true }).retryable).toBe(true);
  });

  it('config and usage failures carry no retry semantics', () => {
    expect(new CrucibleError('config', 'm', { retryable: true }).retryable).toBeUndefined();
    expect(new CrucibleError('usage', 'm').retryable).toBeUndefined();
  });

  it('preserves the underlying cause for diagnostics', () => {
    const cause = new Error('provider blew up');
    expect(new CrucibleError('infra', 'm', { cause }).cause).toBe(cause);
  });
});
