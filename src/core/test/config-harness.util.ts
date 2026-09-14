import { expect } from '@jest/globals';
import { CrucibleError } from '../errors.js';
import { ConfigStore } from '../config.js';
import { Capture } from './capture.util.js';
import { FakeConfigBoundary } from './config-boundary.fake.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { FakeAdapter } from '../../providers/test/adapter.fake.js';

class ConfigHarness {
  static fakeAdapter = new FakeAdapter('fake');

  static registryWithFake(): ProviderRegistry {
    const registry = new ProviderRegistry();
    registry.register('fake', ConfigHarness.fakeAdapter);
    return registry;
  }

  static store(configValue: unknown, verbosityOverride?: string): ConfigStore {
    const raw = typeof configValue === 'string' ? configValue : JSON.stringify(configValue);
    return new ConfigStore(
      new FakeConfigBoundary({ found: true, raw }, verbosityOverride),
      ConfigHarness.registryWithFake(),
    );
  }

  static errorKind(store: ConfigStore): string {
    const error = Capture.thrown(() => store.get());
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }
}

export { ConfigHarness };
