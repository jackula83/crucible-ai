import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { Runner } from '../core/runner.js';
import { RunScope } from '../core/state.js';
import { Capture } from '../core/test/capture.harness.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import { JestBinding } from './jest.js';
import { RegistrarFake } from './test/registrar.fake.js';

class Harness {
  static binding(registrar: RegistrarFake, scope: RunScope = new RunScope()): JestBinding {
    return new JestBinding(new Runner(scope), registrar.register);
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return error as CrucibleError;
  }
}

describe('JestBinding', () => {
  it('registers exactly one test per declaration, with the 30 second smoke budget', () => {
    const registrar = new RegistrarFake();
    Harness.binding(registrar).register('checks coherence', async () => {});
    expect(registrar.registrations).toHaveLength(1);
    expect(registrar.registrations[0]?.name).toBe('checks coherence');
    expect(registrar.registrations[0]?.timeout).toBe(30000);
  });

  it('inert registration — body must not run until the framework invokes the test', () => {
    const registrar = new RegistrarFake();
    let ran = false;
    Harness.binding(registrar).register('inert', async () => {
      ran = true;
    });
    expect(ran).toBe(false);
  });

  it('body runs once inside a run scope — smoke mode is a single run', async () => {
    const registrar = new RegistrarFake();
    const scope = new RunScope();
    let runs = 0;
    Harness.binding(registrar, scope).register('smoke', async () => {
      runs += 1;
    });
    await registrar.registrations[0]?.fn();
    expect(runs).toBe(1);
  });

  it('accepts an empty options object between name and body', async () => {
    const registrar = new RegistrarFake();
    let ran = false;
    Harness.binding(registrar).register('with options', {}, async () => {
      ran = true;
    });
    await registrar.registrations[0]?.fn();
    expect(registrar.registrations).toHaveLength(1);
    expect(ran).toBe(true);
  });

  it.each(['runs', 'threshold'])(
    'rejects "%s" as usage until multi-run gating ships — a silently single-shot gate would lie',
    (key) => {
      const registrar = new RegistrarFake();
      const error = Harness.errorFrom(() =>
        Harness.binding(registrar).register('gated', { [key]: 5 }, async () => {}),
      );
      expect(error.kind).toBe('usage');
    },
  );

  it('rejects an unknown option key as a usage error at registration', () => {
    const registrar = new RegistrarFake();
    const error = Harness.errorFrom(() =>
      Harness.binding(registrar).register(
        'typo',
        { run: 5 } as unknown as Parameters<JestBinding['register']>[1],
        async () => {},
      ),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects a non-function body as a usage error', () => {
    const registrar = new RegistrarFake();
    const error = Harness.errorFrom(() =>
      Harness.binding(registrar).register('bad', {}, 'not a body' as unknown as () => void),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects a body passed in both positions as a usage error', () => {
    const registrar = new RegistrarFake();
    const error = Harness.errorFrom(() =>
      Harness.binding(registrar).register('double', (async () => {}) as never, async () => {}),
    );
    expect(error.kind).toBe('usage');
  });

  it('a body rejection surfaces as a verdict error carrying the original failure', async () => {
    const registrar = new RegistrarFake();
    const failure = new Error('assertion failed');
    Harness.binding(registrar).register('failing', async () => {
      throw failure;
    });
    const registration = registrar.registrations[0];
    expect(registration).toBeDefined();
    const error = await Capture.rejection(registration!.fn());
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).cause).toBe(failure);
  });
});
