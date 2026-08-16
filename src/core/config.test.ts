import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { ConfigStore } from './config.js';
import type { ConfigBoundary, ConfigFileRead } from './config.js';
import { ProviderRegistry } from '../providers/registry.js';
import { FakeAdapter } from '../providers/fake-adapter.js';

class FakeConfigBoundary implements ConfigBoundary {
  fileReads = 0;

  constructor(
    private readonly read: ConfigFileRead,
    private readonly verbosityOverride?: string,
  ) {}

  describeSource(): string {
    return 'fake://crucible.config.json';
  }

  readConfigFile(): ConfigFileRead {
    this.fileReads += 1;
    return this.read;
  }

  readVerbosityOverride(): string | undefined {
    return this.verbosityOverride;
  }
}

const fakeAdapter = new FakeAdapter('fake');

function registryWithFake(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register('fake', fakeAdapter);
  return registry;
}

function storeFor(configValue: unknown, verbosityOverride?: string): ConfigStore {
  const raw = typeof configValue === 'string' ? configValue : JSON.stringify(configValue);
  return new ConfigStore(
    new FakeConfigBoundary({ found: true, raw }, verbosityOverride),
    registryWithFake(),
  );
}

function getError(store: ConfigStore): CrucibleError {
  let caught: unknown;
  try {
    store.get();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(CrucibleError);
  return caught as CrucibleError;
}

describe('ConfigStore with a valid config', () => {
  it('resolves the registered adapter, model, meta, and verbosity', () => {
    const store = storeFor({
      provider: 'fake',
      model: 'deepseek-v3',
      meta: { provider: 'atlascloud', reasoning: 'minimal' },
      verbosity: 'full',
    });
    const config = store.get();
    expect(config.provider).toBe(fakeAdapter);
    expect(config.model).toBe('deepseek-v3');
    expect(config.meta).toEqual({ provider: 'atlascloud', reasoning: 'minimal' });
    expect(config.effectiveVerbosity).toBe('full');
  });

  it('applies defaults when optional fields are omitted', () => {
    const config = storeFor({ provider: 'fake', model: 'm' }).get();
    expect(config.meta).toBeUndefined();
    expect(config.effectiveVerbosity).toBe('default');
  });

  it('passes meta through untouched, nested content included', () => {
    const meta = { anything: { nested: [1, 2, 3] }, routing: 'weird' };
    expect(storeFor({ provider: 'fake', model: 'm', meta }).get().meta).toEqual(meta);
  });

  it('loads once: repeated gets read the file once and return the same config', () => {
    const boundary = new FakeConfigBoundary({
      found: true,
      raw: JSON.stringify({ provider: 'fake', model: 'm' }),
    });
    const store = new ConfigStore(boundary, registryWithFake());
    const first = store.get();
    expect(store.get()).toBe(first);
    expect(boundary.fileReads).toBe(1);
  });

  it('accepts a config file that starts with a UTF-8 byte-order mark', () => {
    const raw = '\uFEFF' + JSON.stringify({ provider: 'fake', model: 'm' });
    expect(storeFor(raw).get().model).toBe('m');
  });
});

describe('ConfigStore rejects invalid configs as config failures', () => {
  it.each([
    ['unknown provider', { provider: 'nope', model: 'm' }],
    ['missing provider', { model: 'm' }],
    ['whitespace provider', { provider: '  ', model: 'm' }],
    ['missing model', { provider: 'fake' }],
    ['empty model', { provider: 'fake', model: '' }],
    ['whitespace model', { provider: 'fake', model: '   ' }],
    ['non-string model', { provider: 'fake', model: 42 }],
    ['non-object meta', { provider: 'fake', model: 'm', meta: 'nope' }],
    ['unknown field', { provider: 'fake', model: 'm', testDefaults: {} }],
    ['invalid verbosity', { provider: 'fake', model: 'm', verbosity: 'quiet' }],
    ['malformed JSON', '{ not json !!!'],
    ['non-object root', '["array"]'],
  ])('%s', (_label, configValue) => {
    expect(getError(storeFor(configValue)).kind).toBe('config');
  });

  it.each(['apiKey', 'API_KEY', 'Key', 'token', 'secret', 'Authorization'])(
    'key-like field "%s" is rejected regardless of casing',
    (field) => {
      expect(getError(storeFor({ provider: 'fake', model: 'm', [field]: 'sk' })).kind).toBe(
        'config',
      );
    },
  );

  it('a missing config file is a config failure', () => {
    const store = new ConfigStore(
      new FakeConfigBoundary({ found: false, reason: 'missing' }),
      registryWithFake(),
    );
    expect(getError(store).kind).toBe('config');
  });

  it('an unreadable config file is a config failure', () => {
    const store = new ConfigStore(
      new FakeConfigBoundary({ found: false, reason: 'unreadable', detail: 'EACCES' }),
      registryWithFake(),
    );
    expect(getError(store).kind).toBe('config');
  });
});

describe('ConfigStore verbosity override', () => {
  it('the override wins over the configured verbosity', () => {
    const store = storeFor({ provider: 'fake', model: 'm', verbosity: 'default' }, 'debug');
    expect(store.get().effectiveVerbosity).toBe('debug');
  });

  it('an empty override falls back to the configured verbosity', () => {
    const store = storeFor({ provider: 'fake', model: 'm', verbosity: 'full' }, '');
    expect(store.get().effectiveVerbosity).toBe('full');
  });

  it('an invalid override is a config failure', () => {
    expect(getError(storeFor({ provider: 'fake', model: 'm' }, 'loud')).kind).toBe('config');
  });
});
