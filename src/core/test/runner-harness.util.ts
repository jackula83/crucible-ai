import { Runner } from '../runner.js';
import { RunScope } from '../state.js';
import { Capture } from './capture.util.js';

class RunnerHarness {
  static async rejection(body: (scope: RunScope) => Promise<never>): Promise<unknown> {
    const scope = new RunScope();
    return Capture.rejection(new Runner(scope).execute(() => body(scope)));
  }

  static async falseVerdictRejection(cause: unknown): Promise<unknown> {
    return RunnerHarness.rejection(async (scope) => {
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

export { RunnerHarness };
