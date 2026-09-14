import { expect } from '@jest/globals';
import { CrucibleError } from '../../core/errors.js';
import { Capture } from '../../core/test/capture.util.js';

class RegistryHarness {
  static errorKind(fn: () => unknown): string {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }
}

export { RegistryHarness };
