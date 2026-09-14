import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { Runner } from './runner.js';
import { RunScope } from './state.js';
import { Capture } from './test/capture.harness.js';
import { CrucibleVerdictError } from './verdict-error.js';

class Harness {
  static async rejection(body: (scope: RunScope) => Promise<never>): Promise<unknown> {
    const scope = new RunScope();
    return Capture.rejection(new Runner(scope).execute(() => body(scope)));
  }

  static async falseVerdictRejection(cause: unknown): Promise<unknown> {
    return Harness.rejection(async (scope) => {
      scope.recordVerdict({
        assertion: 'coherent',
        claim: 'the claim',
        verdict: false,
        reasoning: 'the reasoning',
        response: 'the response',
      });
      throw cause;
    });
  }
}

describe('Runner', () => {
  it('resolves with the body value when the run passes', async () => {
    await expect(new Runner(new RunScope()).execute(() => 'the value')).resolves.toBe('the value');
  });

  it('turns a rejection after a false verdict into a failed CrucibleVerdictError', async () => {
    const cause = new Error('expect(received).toBe(expected)');
    const error = await Harness.falseVerdictRejection(cause);
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('failed');
    expect((error as CrucibleVerdictError).cause).toBe(cause);
  });

  it('turns an infra rejection into an errored CrucibleVerdictError', async () => {
    const cause = new CrucibleError('infra', 'provider unreachable');
    const error = await Harness.rejection(async (scope) => {
      scope.recordError({ cause, attempts: 1 });
      throw cause;
    });
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
    expect((error as CrucibleVerdictError).cause).toBe(cause);
  });

  it('classifies a wrapped infra rejection as errored by walking the cause chain', async () => {
    const infra = new CrucibleError('infra', 'provider unreachable');
    const wrapped = new Error('re-thrown by user code', { cause: infra });
    const error = await Harness.rejection(async () => {
      throw wrapped;
    });
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
    expect((error as CrucibleVerdictError).cause).toBe(wrapped);
  });

  it('turns a plain rejection with no records into a failed CrucibleVerdictError', async () => {
    const cause = new RangeError('index out of bounds');
    const error = await Harness.rejection(async () => {
      throw cause;
    });
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('failed');
    expect((error as CrucibleVerdictError).cause).toBe(cause);
  });

  it.each(['config', 'usage'] as const)(
    'rethrows a %s error untouched — misconfiguration must not masquerade as a verdict',
    async (kind) => {
      const cause = new CrucibleError(kind, 'fix your setup');
      const error = await Harness.rejection(async () => {
        throw cause;
      });
      expect(error).toBe(cause);
    },
  );

  it('rethrows an already-wrapped CrucibleVerdictError untouched — no double wrapping', async () => {
    const inner = new CrucibleVerdictError('errored', 'already rendered', new Error('root'));
    const error = await Harness.rejection(async () => {
      throw inner;
    });
    expect(error).toBe(inner);
  });
});
