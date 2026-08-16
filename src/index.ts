import { CrucibleError } from './core/errors.js';

/**
 * Public entry point: the single `crucible` namespace (AR11).
 * Importing this module is side-effect-free — no config load, no env access
 * (AD-9). Config is only ever loaded lazily inside run execution.
 */

function notImplementedYet(member: string): never {
  throw new CrucibleError(
    'usage',
    `crucible.${member} is not implemented yet — coming in Story 1.4.`,
  );
}

export { CrucibleError } from './core/errors.js';
export type { CrucibleErrorKind } from './core/errors.js';
export type { CompletionRequest, FailureClass, ProviderAdapter } from './providers/types.js';

export const crucible = Object.freeze({
  /** Define a coherence test. Coming in Story 1.4. */
  it(): never {
    return notImplementedYet('it');
  },
  /** Coherence assertion. Coming in Story 1.4. */
  coherent(): never {
    return notImplementedYet('coherent');
  },
  /** Load state fixtures. Coming in Story 1.4. */
  load(): never {
    return notImplementedYet('load');
  },
});
