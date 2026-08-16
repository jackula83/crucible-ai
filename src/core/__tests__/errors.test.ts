import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../errors.js';

describe('CrucibleError', () => {
  it('is an instanceof Error and CrucibleError', () => {
    const err = new CrucibleError('config', 'bad config');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CrucibleError);
    expect(err.name).toBe('CrucibleError');
  });

  it('passes the message through', () => {
    const err = new CrucibleError('usage', 'not implemented yet');
    expect(err.message).toBe('not implemented yet');
  });

  it('discriminates on kind: config', () => {
    expect(new CrucibleError('config', 'x').kind).toBe('config');
  });

  it('discriminates on kind: usage', () => {
    expect(new CrucibleError('usage', 'x').kind).toBe('usage');
  });

  it('discriminates on kind: infra', () => {
    expect(new CrucibleError('infra', 'x').kind).toBe('infra');
  });

  it('infra carries a retryable flag', () => {
    const retryable = new CrucibleError('infra', 'timeout', { retryable: true });
    const fatal = new CrucibleError('infra', 'auth failed', { retryable: false });
    expect(retryable.retryable).toBe(true);
    expect(fatal.retryable).toBe(false);
  });

  it('infra defaults retryable to false when not given', () => {
    expect(new CrucibleError('infra', 'x').retryable).toBe(false);
  });

  it('infra carries the provider cause', () => {
    const cause = new Error('socket hang up');
    const err = new CrucibleError('infra', 'provider failed', { retryable: true, cause });
    expect(err.cause).toBe(cause);
  });

  it('non-infra kinds have no retryable flag', () => {
    expect(new CrucibleError('config', 'x').retryable).toBeUndefined();
    expect(new CrucibleError('usage', 'x').retryable).toBeUndefined();
  });
});
