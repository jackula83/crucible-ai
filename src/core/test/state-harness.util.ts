import type { VerdictRecord } from '../state.js';

class StateHarness {
  static verdict(claim: string): Omit<VerdictRecord, 'seq'> {
    return {
      assertion: 'coherent',
      claim,
      verdict: true,
      reasoning: 'consistent',
      response: 'the response',
    };
  }
}

export { StateHarness };
