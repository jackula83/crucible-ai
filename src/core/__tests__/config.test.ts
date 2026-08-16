import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CrucibleError } from '../errors.js';
import { config, resetConfigForTesting } from '../config.js';
import { clearRegistryForTesting, register } from '../../providers/registry.js';
import { makeFakeAdapter } from '../../providers/__tests__/fake-adapter.js';

const fakeAdapter = makeFakeAdapter('fake');

let tempDir: string;
let originalCwd: string;
let originalEnv: NodeJS.ProcessEnv;

function writeConfig(value: unknown): void {
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  writeFileSync(join(tempDir, 'crucible.config.json'), body);
}

function getError(): CrucibleError {
  let caught: unknown;
  try {
    config.get();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(CrucibleError);
  return caught as CrucibleError;
}

beforeEach(() => {
  originalCwd = process.cwd();
  originalEnv = { ...process.env };
  delete process.env.CRUCIBLE_VERBOSE;
  tempDir = mkdtempSync(join(tmpdir(), 'crucible-config-'));
  process.chdir(tempDir);
  clearRegistryForTesting();
  register('fake', fakeAdapter);
  resetConfigForTesting();
});

afterEach(() => {
  process.chdir(originalCwd);
  process.env = originalEnv;
  rmSync(tempDir, { recursive: true, force: true });
  clearRegistryForTesting();
  resetConfigForTesting();
});

describe('config.get() — valid config', () => {
  it('resolves the adapter singleton, model, meta, and effectiveVerbosity', () => {
    writeConfig({
      provider: 'fake',
      model: 'deepseek-v3',
      meta: { provider: 'atlascloud', reasoning: 'minimal' },
      verbosity: 'default',
    });
    const cfg = config.get();
    expect(cfg.provider).toBe(fakeAdapter);
    expect(cfg.model).toBe('deepseek-v3');
    expect(cfg.meta).toEqual({ provider: 'atlascloud', reasoning: 'minimal' });
    expect(cfg.effectiveVerbosity).toBe('default');
  });

  it('works without the optional meta and verbosity fields', () => {
    writeConfig({ provider: 'fake', model: 'm' });
    const cfg = config.get();
    expect(cfg.meta).toBeUndefined();
    expect(cfg.effectiveVerbosity).toBe('default');
  });

  it('returns a frozen object', () => {
    writeConfig({ provider: 'fake', model: 'm' });
    expect(Object.isFrozen(config.get())).toBe(true);
  });

  it('memoizes: a second get() returns the same instance even if the file changes', () => {
    writeConfig({ provider: 'fake', model: 'm' });
    const first = config.get();
    writeConfig({ provider: 'fake', model: 'changed' });
    expect(config.get()).toBe(first);
    expect(config.get().model).toBe('m');
  });

  it('passes meta through untouched, including nested unknown keys (FR7)', () => {
    const meta = { anything: { nested: [1, 2, 3] }, apiKeyShapedButOpaque: true };
    writeConfig({ provider: 'fake', model: 'm', meta });
    expect(config.get().meta).toEqual(meta);
  });
});

describe('config.get() — provider and model validation', () => {
  it('unknown provider throws a config error naming the value and listing registered providers', () => {
    writeConfig({ provider: 'nope', model: 'm' });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toContain('nope');
    expect(err.message).toContain('fake');
  });

  it('missing provider throws a config error', () => {
    writeConfig({ model: 'm' });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toMatch(/provider/i);
  });

  it('missing model throws a config error', () => {
    writeConfig({ provider: 'fake' });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toMatch(/model/i);
  });

  it('empty model throws a config error', () => {
    writeConfig({ provider: 'fake', model: '' });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toMatch(/model/i);
  });

  it('non-string model throws a config error', () => {
    writeConfig({ provider: 'fake', model: 42 });
    expect(getError().message).toMatch(/model/i);
  });
});

describe('config.get() — file problems', () => {
  it('missing file throws a config error naming the path and the fix', () => {
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toContain(join(tempDir, 'crucible.config.json'));
    expect(err.message).toMatch(/create/i);
  });

  it('malformed JSON throws a config error naming the path', () => {
    writeConfig('{ not json !!!');
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toContain(join(tempDir, 'crucible.config.json'));
    expect(err.message).toMatch(/json/i);
  });

  it('a non-object JSON root throws a config error', () => {
    writeConfig('["array"]');
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toMatch(/object/i);
  });
});

describe('config.get() — key-like fields are rejected (NFR1)', () => {
  it.each(['APIKEY', 'API_KEY', 'Key', 'TOKEN', 'secret', 'Authorization'])(
    'rejects key-like field "%s" case-insensitively',
    (field) => {
      writeConfig({ provider: 'fake', model: 'm', [field]: 'sk-secret' });
      const err = getError();
      expect(err.kind).toBe('config');
      expect(err.message).toContain(field);
    },
  );

  it.each(['apiKey', 'api_key', 'key', 'token'])(
    'rejects "%s" directing the user to the provider env var',
    (field) => {
      writeConfig({ provider: 'fake', model: 'm', [field]: 'sk-secret' });
      const err = getError();
      expect(err.kind).toBe('config');
      expect(err.message).toContain(field);
      expect(err.message).toContain('FAKE_API_KEY');
    },
  );

  it('rejects key-like fields with generic env-var guidance when the provider is unknown', () => {
    writeConfig({ provider: 'nope', model: 'm', apiKey: 'sk-secret' });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toContain('apiKey');
    expect(err.message).toMatch(/environment variable/i);
  });
});

describe('config.get() — unknown fields are rejected', () => {
  it('rejects testDefaults as an unknown field (Story 2.5, not yet)', () => {
    writeConfig({ provider: 'fake', model: 'm', testDefaults: {} });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toContain('testDefaults');
  });

  it('names the unknown field and the allowed fields', () => {
    writeConfig({ provider: 'fake', model: 'm', verbose: 'full' });
    const err = getError();
    expect(err.message).toContain('verbose');
    expect(err.message).toContain('verbosity');
  });

  it('rejects a non-object meta', () => {
    writeConfig({ provider: 'fake', model: 'm', meta: 'nope' });
    expect(getError().message).toMatch(/meta/i);
  });
});

describe('config.get() — effectiveVerbosity resolution', () => {
  it('env CRUCIBLE_VERBOSE wins over config verbosity', () => {
    process.env.CRUCIBLE_VERBOSE = 'full';
    writeConfig({ provider: 'fake', model: 'm', verbosity: 'default' });
    expect(config.get().effectiveVerbosity).toBe('full');
  });

  it('falls back to config verbosity when env is unset', () => {
    writeConfig({ provider: 'fake', model: 'm', verbosity: 'debug' });
    expect(config.get().effectiveVerbosity).toBe('debug');
  });

  it('defaults to "default" with no env and no config verbosity', () => {
    writeConfig({ provider: 'fake', model: 'm' });
    expect(config.get().effectiveVerbosity).toBe('default');
  });

  it('invalid env value throws naming the valid levels', () => {
    process.env.CRUCIBLE_VERBOSE = 'loud';
    writeConfig({ provider: 'fake', model: 'm' });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toContain('loud');
    expect(err.message).toContain('default');
    expect(err.message).toContain('full');
    expect(err.message).toContain('debug');
  });

  it('invalid config verbosity value throws naming the valid levels', () => {
    writeConfig({ provider: 'fake', model: 'm', verbosity: 'quiet' });
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).toContain('quiet');
    expect(err.message).toContain('debug');
  });

  it('a set-but-empty CRUCIBLE_VERBOSE is treated as unset (falls through to config)', () => {
    process.env.CRUCIBLE_VERBOSE = '';
    writeConfig({ provider: 'fake', model: 'm', verbosity: 'debug' });
    expect(config.get().effectiveVerbosity).toBe('debug');
  });
});

describe('config.get() — robustness edge cases', () => {
  it('an unreadable-but-existing config path reports the read failure, not "create the file"', () => {
    mkdirSync(join(tempDir, 'crucible.config.json'));
    const err = getError();
    expect(err.kind).toBe('config');
    expect(err.message).not.toMatch(/create/i);
    expect(err.message).toMatch(/read/i);
  });

  it('accepts a config file saved with a UTF-8 BOM', () => {
    writeConfig('﻿' + JSON.stringify({ provider: 'fake', model: 'm' }));
    expect(config.get().model).toBe('m');
  });

  it('whitespace-only model is rejected', () => {
    writeConfig({ provider: 'fake', model: '   ' });
    expect(getError().message).toMatch(/model/i);
  });

  it('whitespace-only provider is rejected', () => {
    writeConfig({ provider: '  ', model: 'm' });
    expect(getError().message).toMatch(/provider/i);
  });
});
