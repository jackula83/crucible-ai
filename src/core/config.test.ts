import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { ConfigStore } from './config.js';
import { Capture } from './test/capture.harness.js';
import { FakeConfigBoundary } from './test/config-boundary.fake.js';
import { ProviderRegistry, providerRegistry } from '../providers/registry.js';
import { FakeAdapter } from '../providers/test/adapter.fake.js';
import { ROUTING_META } from '../providers/test/routing-meta.fake.js';
import { TestModel } from '../providers/test/test-model.enum.js';

const fakeAdapter = new FakeAdapter('fake');

class Harness {
  static registryWithFake(): ProviderRegistry {
    const registry = new ProviderRegistry();
    registry.register('fake', fakeAdapter);
    return registry;
  }

  static store(configValue: unknown, verbosityOverride?: string): ConfigStore {
    const raw = typeof configValue === 'string' ? configValue : JSON.stringify(configValue);
    return new ConfigStore(
      new FakeConfigBoundary({ found: true, raw }, verbosityOverride),
      Harness.registryWithFake(),
    );
  }

  static errorKind(store: ConfigStore): string {
    const error = Capture.thrown(() => store.get());
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }
}

describe('ConfigStore with a valid config', () => {
  it('resolves the registered adapter, model, meta, and verbosity', () => {
    const store = Harness.store({
      provider: 'fake',
      model: TestModel.DeepseekV3,
      meta: ROUTING_META,
      verbosity: 'full',
    });
    const config = store.get();
    expect(config.provider).toBe(fakeAdapter);
    expect(config.model).toBe(TestModel.DeepseekV3);
    expect(config.meta).toEqual(ROUTING_META);
    expect(config.effectiveVerbosity).toBe('full');
  });

  it('resolves the built-in openrouter provider singleton through the default registry', () => {
    const store = new ConfigStore(
      new FakeConfigBoundary({
        found: true,
        raw: JSON.stringify({ provider: 'openrouter', model: TestModel.Gpt5 }),
      }),
      providerRegistry,
    );
    expect(store.get().provider).toBe(providerRegistry.resolve('openrouter'));
  });

  it('applies defaults when optional fields are omitted', () => {
    const config = Harness.store({ provider: 'fake', model: TestModel.Generic }).get();
    expect(config.meta).toBeUndefined();
    expect(config.effectiveVerbosity).toBe('default');
  });

  it('passes meta through untouched, nested content included', () => {
    const meta = { anything: { nested: [1, 2, 3] }, routing: 'weird' };
    expect(Harness.store({ provider: 'fake', model: TestModel.Generic, meta }).get().meta).toEqual(
      meta,
    );
  });

  it('memoizes: repeated gets return the same config instance', () => {
    const store = Harness.store({ provider: 'fake', model: TestModel.Generic });
    expect(store.get()).toBe(store.get());
  });

  it('accepts a config file that starts with a UTF-8 byte-order mark', () => {
    const raw = '﻿' + JSON.stringify({ provider: 'fake', model: TestModel.Generic });
    expect(Harness.store(raw).get().model).toBe(TestModel.Generic);
  });
});

describe('ConfigStore rejects invalid configs as config failures', () => {
  it.each([
    ['unknown provider', { provider: 'nope', model: TestModel.Generic }],
    ['missing provider', { model: TestModel.Generic }],
    ['whitespace provider', { provider: '  ', model: TestModel.Generic }],
    ['missing model', { provider: 'fake' }],
    ['empty model', { provider: 'fake', model: '' }],
    ['whitespace model', { provider: 'fake', model: '   ' }],
    ['non-string model', { provider: 'fake', model: 42 }],
    ['non-object meta', { provider: 'fake', model: TestModel.Generic, meta: 'nope' }],
    ['unknown field', { provider: 'fake', model: TestModel.Generic, testDefaults: {} }],
    ['invalid verbosity', { provider: 'fake', model: TestModel.Generic, verbosity: 'quiet' }],
    ['malformed JSON', '{ not json !!!'],
    ['non-object root', '["array"]'],
  ])('%s', (_label, configValue) => {
    expect(Harness.errorKind(Harness.store(configValue))).toBe('config');
  });

  it.each(['apiKey', 'API_KEY', 'Key', 'token', 'secret', 'Authorization'])(
    'key-like field "%s" is rejected regardless of casing',
    (field) => {
      expect(
        Harness.errorKind(
          Harness.store({ provider: 'fake', model: TestModel.Generic, [field]: 'sk' }),
        ),
      ).toBe('config');
    },
  );

  it('a missing config file is a config failure', () => {
    const store = new ConfigStore(
      new FakeConfigBoundary({ found: false, reason: 'missing' }),
      Harness.registryWithFake(),
    );
    expect(Harness.errorKind(store)).toBe('config');
  });

  it('an unreadable config file is a config failure', () => {
    const store = new ConfigStore(
      new FakeConfigBoundary({ found: false, reason: 'unreadable', detail: 'EACCES' }),
      Harness.registryWithFake(),
    );
    expect(Harness.errorKind(store)).toBe('config');
  });
});

describe('ConfigStore verbosity override', () => {
  it('the override wins over the configured verbosity', () => {
    const store = Harness.store(
      { provider: 'fake', model: TestModel.Generic, verbosity: 'default' },
      'debug',
    );
    expect(store.get().effectiveVerbosity).toBe('debug');
  });

  it('an empty override falls back to the configured verbosity', () => {
    const store = Harness.store(
      { provider: 'fake', model: TestModel.Generic, verbosity: 'full' },
      '',
    );
    expect(store.get().effectiveVerbosity).toBe('full');
  });

  it('an invalid override is a config failure', () => {
    expect(
      Harness.errorKind(Harness.store({ provider: 'fake', model: TestModel.Generic }, 'loud')),
    ).toBe('config');
  });
});
