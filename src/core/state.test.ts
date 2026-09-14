import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RunScope } from './state.js';
import type { VerdictRecord } from './state.js';
import { Capture } from './test/capture.harness.js';

class Harness {
  static verdict(claim: string): Omit<VerdictRecord, 'seq'> {
    return { assertion: 'coherent', claim, verdict: true, reasoning: 'consistent' };
  }
}

describe('RunScope', () => {
  it('gives every run a fresh context — concurrent runs never see each other', async () => {
    const scope = new RunScope();
    const [first, second] = await Promise.all([
      scope.enterRun(async () => {
        scope.context().state.push('first-fact');
        scope.recordVerdict(Harness.verdict('first claim'));
        await Promise.resolve();
        return scope.context();
      }),
      scope.enterRun(async () => {
        await Promise.resolve();
        scope.recordVerdict(Harness.verdict('second claim'));
        return scope.context();
      }),
    ]);
    expect(first.verdicts.map((record) => record.claim)).toEqual(['first claim']);
    expect(second.verdicts.map((record) => record.claim)).toEqual(['second claim']);
    expect(first.state).toEqual(['first-fact']);
    expect(second.state).toEqual([]);
  });

  it('reading context outside a run scope is a usage error', () => {
    const error = Capture.thrown(() => new RunScope().context());
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('recording a verdict outside a run scope is a usage error', () => {
    const error = Capture.thrown(() => new RunScope().recordVerdict(Harness.verdict('claim')));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('appended verdicts are readable within the same run, in sequence order', async () => {
    const scope = new RunScope();
    const verdicts = await scope.enterRun(async () => {
      scope.recordVerdict(Harness.verdict('first claim'));
      scope.recordVerdict(Harness.verdict('second claim'));
      return scope.context().verdicts;
    });
    expect(verdicts.map((record) => ({ claim: record.claim, seq: record.seq }))).toEqual([
      { claim: 'first claim', seq: 0 },
      { claim: 'second claim', seq: 1 },
    ]);
  });

  it('verdicts and errors share one sequence so run history keeps its order', async () => {
    const scope = new RunScope();
    const context = await scope.enterRun(async () => {
      scope.recordVerdict(Harness.verdict('claim'));
      scope.recordError({ cause: new Error('boom'), attempts: 1 });
      return scope.context();
    });
    expect(context.verdicts[0]?.seq).toBe(0);
    expect(context.errors[0]?.seq).toBe(1);
  });
});
