import { CrucibleError } from './errors.js';
import { Reporter } from './report.js';
import { RunScope, runScope } from './state.js';
import { CrucibleVerdictError } from './verdict-error.js';

class Runner {
  constructor(
    private readonly scope: RunScope = runScope,
    private readonly reporter: Reporter = new Reporter(),
  ) {}

  execute<T>(body: () => Promise<T> | T): Promise<T> {
    return this.scope.enterRun(async () => {
      try {
        return await body();
      } catch (cause) {
        throw this.verdictError(cause);
      }
    });
  }

  private verdictError(cause: unknown): unknown {
    if (cause instanceof CrucibleVerdictError) {
      return cause;
    }
    const crucible = this.firstCrucibleInChain(cause);
    if (crucible !== undefined && crucible.kind !== 'infra') {
      return cause;
    }
    const context = this.scope.context();
    if (crucible !== undefined) {
      return new CrucibleVerdictError(
        'errored',
        this.reporter.renderErrored(context, cause),
        cause,
      );
    }
    return new CrucibleVerdictError('failed', this.reporter.renderFailed(context, cause), cause);
  }

  private firstCrucibleInChain(cause: unknown): CrucibleError | undefined {
    let current = cause;
    while (current !== null && current !== undefined) {
      if (current instanceof CrucibleError) {
        return current;
      }
      current = current instanceof Error ? current.cause : undefined;
    }
    return undefined;
  }
}

export { Runner };
