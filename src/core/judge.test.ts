import { describe, expect, it } from '@jest/globals';
import { TestModel } from '../providers/test/test-model.enum.js';
import { CrucibleError } from './errors.js';
import { Judge } from './judge.js';
import { RetryingCompleter } from './retry.js';
import { RunScope } from './state.js';
import { Capture } from './test/capture.harness.js';
import { ScriptedAdapter } from './test/scripted-adapter.fake.js';
import { SleepRecorder } from './test/sleep-recorder.fake.js';

class Harness {
  static judge(adapter: ScriptedAdapter, scope: RunScope): Judge {
    return new Judge(
      () => 'judge schema text',
      new RetryingCompleter(new SleepRecorder().sleep),
      () => ({ adapter, model: TestModel.Generic }),
      scope,
    );
  }

  static judgeReplies(replies: string[]): Promise<boolean> {
    const scope = new RunScope();
    const judge = Harness.judge(
      new ScriptedAdapter(
        replies.map((reply) => ({ resolve: reply })),
        'retryable',
      ),
      scope,
    );
    return scope.enterRun(() => judge.judgeCoherent('the response', 'the claim'));
  }

  static judgeReply(reply: string): Promise<boolean> {
    return Harness.judgeReplies([reply, reply]);
  }

  static async replyFailure(reply: string): Promise<unknown> {
    return Capture.rejection(Harness.judgeReply(reply));
  }
}

describe('Judge', () => {
  it('resolves true when the judge reply says the response is coherent', async () => {
    await expect(Harness.judgeReply('{"verdict":true,"reasoning":"consistent"}')).resolves.toBe(
      true,
    );
  });

  it('resolves false when the judge reply says the response contradicts the claim', async () => {
    await expect(Harness.judgeReply('{"verdict":false,"reasoning":"contradiction"}')).resolves.toBe(
      false,
    );
  });

  it('parses a reply padded with whitespace and newlines', async () => {
    await expect(
      Harness.judgeReply('\n\n   {"verdict":true,"reasoning":"consistent"}  \n'),
    ).resolves.toBe(true);
  });

  it('a non-JSON reply is a retryable infra error, never a verdict', async () => {
    const error = await Harness.replyFailure('the response is coherent');
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });

  it('a JSON reply without a boolean verdict and string reasoning is a retryable infra error', async () => {
    const error = await Harness.replyFailure('{"verdict":"yes","reasoning":42}');
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });

  it('re-asks once after an unparseable reply and accepts a valid second reply', async () => {
    await expect(
      Harness.judgeReplies(['not json at all', '{"verdict":true,"reasoning":"second try"}']),
    ).resolves.toBe(true);
  });

  it('an unparseable reply after the re-ask leaves an ErrorRecord readable within the run', async () => {
    const scope = new RunScope();
    const judge = Harness.judge(
      new ScriptedAdapter([{ resolve: 'still not json' }, { resolve: 'nope' }], 'retryable'),
      scope,
    );
    const outcome = await scope.enterRun(async () => {
      const error = await Capture.rejection(judge.judgeCoherent('the response', 'the claim'));
      return { error, errors: scope.context().errors };
    });
    expect(outcome.error).toBeInstanceOf(CrucibleError);
    expect((outcome.error as CrucibleError).kind).toBe('infra');
    expect((outcome.error as CrucibleError).retryable).toBe(true);
    expect(outcome.errors).toHaveLength(1);
  });

  it('parses a verdict wrapped in markdown code fences', async () => {
    await expect(
      Harness.judgeReply('```json\n{"verdict":true,"reasoning":"fenced"}\n```'),
    ).resolves.toBe(true);
  });

  it.each([
    ['undefined response', undefined, 'claim'],
    ['object claim', 'response', { not: 'a string' }],
  ])('rejects a non-string argument (%s) as a usage error', async (_label, response, claim) => {
    const scope = new RunScope();
    const judge = Harness.judge(new ScriptedAdapter([], 'retryable'), scope);
    const error = await scope.enterRun(() =>
      Capture.rejection(judge.judgeCoherent(response as string, claim as string)),
    );
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('judging outside a run scope is a usage error', async () => {
    const judge = Harness.judge(new ScriptedAdapter([], 'retryable'), new RunScope());
    const error = await Capture.rejection(judge.judgeCoherent('the response', 'the claim'));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('an infra failure propagates and leaves an ErrorRecord readable within the run', async () => {
    const scope = new RunScope();
    const cause = new Error('provider down');
    const judge = Harness.judge(new ScriptedAdapter([{ reject: cause }], 'fatal'), scope);
    const outcome = await scope.enterRun(async () => {
      const error = await Capture.rejection(judge.judgeCoherent('the response', 'the claim'));
      return { error, errors: scope.context().errors };
    });
    expect(outcome.error).toBeInstanceOf(CrucibleError);
    expect((outcome.error as CrucibleError).kind).toBe('infra');
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]?.attempts).toBe(1);
  });

  it('a successful judgment appends a VerdictRecord readable within the run', async () => {
    const scope = new RunScope();
    const judge = Harness.judge(
      new ScriptedAdapter(
        [{ resolve: '{"verdict":false,"reasoning":"names the mismatch"}' }],
        'retryable',
      ),
      scope,
    );
    const verdicts = await scope.enterRun(async () => {
      await judge.judgeCoherent('the response', 'the claim');
      return scope.context().verdicts;
    });
    expect(verdicts).toEqual([
      {
        assertion: 'coherent',
        claim: 'the claim',
        verdict: false,
        reasoning: 'names the mismatch',
        seq: 0,
      },
    ]);
  });
});
