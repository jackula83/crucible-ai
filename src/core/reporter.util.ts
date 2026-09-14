import type { ErrorRecord, RunContext, VerdictRecord } from './state.js';

const RESPONSE_EXCERPT_LIMIT = 500;
const TRUNCATION_MARKER = '…';

type FirstFailure =
  { kind: 'verdict'; record: VerdictRecord } | { kind: 'error'; record: ErrorRecord } | undefined;

class Reporter {
  renderFailed(context: RunContext, cause: unknown): string {
    const first = this.firstFailure(context);
    if (first === undefined) {
      return `Run failed: ${this.describe(cause)}`;
    }
    if (first.kind === 'error') {
      return [
        'Run failed after a judge call errored.',
        `Judge error: ${this.describe(first.record.cause)}`,
        `Thrown: ${this.describe(cause)}`,
      ].join('\n');
    }
    return [
      'Coherence check failed.',
      `Claim: ${first.record.claim}`,
      `Judge reasoning: ${first.record.reasoning}`,
      `Response excerpt: ${this.excerpt(first.record.response)}`,
      `Thrown: ${this.describe(cause)}`,
    ].join('\n');
  }

  renderErrored(context: RunContext, cause: unknown): string {
    const lines = [
      'Run errored, not failed: an infrastructure problem prevented a verdict.',
      `Cause: ${this.describe(cause)}`,
    ];
    const attempts = this.lowestSeqError(context)?.attempts;
    if (attempts !== undefined) {
      lines.push(`Judge attempts: ${attempts}`);
    }
    return lines.join('\n');
  }

  private firstFailure(context: RunContext): FirstFailure {
    const verdict = context.verdicts
      .filter((record) => record.verdict === false)
      .reduce<VerdictRecord | undefined>(
        (lowest, record) => (lowest === undefined || record.seq < lowest.seq ? record : lowest),
        undefined,
      );
    const error = this.lowestSeqError(context);
    if (verdict === undefined && error === undefined) {
      return undefined;
    }
    if (error === undefined || (verdict !== undefined && verdict.seq < error.seq)) {
      return { kind: 'verdict', record: verdict as VerdictRecord };
    }
    return { kind: 'error', record: error };
  }

  private lowestSeqError(context: RunContext): ErrorRecord | undefined {
    return context.errors.reduce<ErrorRecord | undefined>(
      (lowest, record) => (lowest === undefined || record.seq < lowest.seq ? record : lowest),
      undefined,
    );
  }

  private excerpt(response: string): string {
    if (response.length <= RESPONSE_EXCERPT_LIMIT) {
      return response;
    }
    const cut = response.slice(0, RESPONSE_EXCERPT_LIMIT).replace(/[\uD800-\uDBFF]$/, '');
    return cut + TRUNCATION_MARKER;
  }

  private describe(cause: unknown): string {
    if (cause instanceof Error) {
      return `${cause.name}: ${cause.message}`;
    }
    try {
      const json = JSON.stringify(cause);
      if (json !== undefined && json !== '{}') {
        return json;
      }
      return String(cause);
    } catch {
      try {
        return String(cause);
      } catch {
        return '[unrenderable cause]';
      }
    }
  }
}

export { Reporter };
