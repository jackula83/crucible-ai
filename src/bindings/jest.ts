import { CrucibleError } from '../core/errors.js';
import { Runner } from '../core/runner.js';

const SMOKE_TEST_TIMEOUT_MS = 30000;

type TestBody = () => unknown;
type RunOptions = {
  readonly runs?: number;
  readonly threshold?: number;
};
type Registrar = (name: string, fn: () => Promise<void>, timeout?: number) => void;

const GATING_OPTION_KEYS = ['runs', 'threshold'] as const;

class JestBinding {
  private static lazyJestRegistrar(
    name: string,
    fn: () => Promise<void>,
    timeout?: number,
  ): void {
    const registrar = (globalThis as { it?: Registrar }).it;
    if (typeof registrar !== 'function') {
      throw new CrucibleError(
        'usage',
        'crucible.it needs Jest with injected globals: no callable global "it" was found ' +
          '(injectGlobals: false is not supported in v1).',
      );
    }
    registrar(name, fn, timeout);
  }

  constructor(
    private readonly runner: Runner,
    private readonly registrar: Registrar = JestBinding.lazyJestRegistrar,
  ) {}

  register(name: string, optsOrBody: RunOptions | TestBody, maybeBody?: TestBody): void {
    const body = this.normalizeBody(optsOrBody, maybeBody);
    this.registrar(
      name,
      async () => {
        await this.runner.execute(body);
      },
      SMOKE_TEST_TIMEOUT_MS,
    );
  }

  private normalizeBody(optsOrBody: RunOptions | TestBody, maybeBody?: TestBody): TestBody {
    if (typeof optsOrBody === 'function') {
      if (maybeBody !== undefined) {
        throw new CrucibleError(
          'usage',
          'crucible.it received two bodies; pass options first, then the body.',
        );
      }
      return optsOrBody;
    }
    this.rejectUnsupportedOptions(optsOrBody);
    if (typeof maybeBody !== 'function') {
      throw new CrucibleError('usage', 'crucible.it needs a test body function.');
    }
    return maybeBody;
  }

  private rejectUnsupportedOptions(opts: RunOptions): void {
    const gating = new Set<string>(GATING_OPTION_KEYS);
    for (const key of Object.keys(opts)) {
      if (gating.has(key)) {
        throw new CrucibleError(
          'usage',
          `crucible.it option "${key}" is not implemented yet — multi-run gating arrives in Story 2.1.`,
        );
      }
      throw new CrucibleError(
        'usage',
        `Unknown crucible.it option "${key}". Supported options: ${GATING_OPTION_KEYS.join(', ')} (coming in Story 2.1).`,
      );
    }
  }
}

export { JestBinding, SMOKE_TEST_TIMEOUT_MS };
export type { Registrar, RunOptions, TestBody };
