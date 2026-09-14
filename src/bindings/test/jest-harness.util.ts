import { expect } from '@jest/globals';
import { CrucibleError } from '../../core/errors.js';
import { Runner } from '../../core/runner.js';
import { RunScope } from '../../core/state.js';
import { Capture } from '../../core/test/capture.util.js';
import { JestBinding } from '../jest.js';
import { RegistrarFake } from './registrar.fake.js';

class JestBindingHarness {
  static binding(registrar: RegistrarFake, scope: RunScope = new RunScope()): JestBinding {
    return new JestBinding(new Runner(scope), registrar.register);
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return error as CrucibleError;
  }
}

export { JestBindingHarness };
