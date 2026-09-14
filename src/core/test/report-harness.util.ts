import { Reporter } from '../reporter.util.js';
import type { ErrorRecord, RunContext, VerdictRecord } from '../state.js';

class ReportHarness {
  static context(verdicts: VerdictRecord[] = [], errors: ErrorRecord[] = []): RunContext {
    return { state: [], verdicts, errors };
  }

  static falseVerdict(overrides: Partial<VerdictRecord> = {}): VerdictRecord {
    return {
      assertion: 'coherent',
      claim: 'the claim',
      verdict: false,
      reasoning: 'the reasoning',
      response: 'the response',
      seq: 0,
      ...overrides,
    };
  }

  static renderedFailure(
    verdicts: VerdictRecord[],
    cause: unknown = new Error('boom'),
    errors: ErrorRecord[] = [],
  ): string {
    return new Reporter().renderFailed(ReportHarness.context(verdicts, errors), cause);
  }
}

export { ReportHarness };
