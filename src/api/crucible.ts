import { CrucibleError } from '../core/errors.js';

function notImplementedYet(member: string): never {
  throw new CrucibleError(
    'usage',
    `crucible.${member} is not implemented yet — coming in Story 1.4.`,
  );
}

const crucible = Object.freeze({
  it(): never {
    return notImplementedYet('it');
  },
  coherent(): never {
    return notImplementedYet('coherent');
  },
  load(): never {
    return notImplementedYet('load');
  },
});

export { crucible, CrucibleError };
export type { CrucibleErrorKind } from '../core/errors.js';
export type { CompletionRequest, FailureClass, ProviderAdapter } from '../providers/types.js';
