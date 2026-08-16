import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CrucibleError } from '../core/errors.js';

let tempDir: string;
let originalCwd: string;
let crucible: typeof import('../index.js').crucible;
const envReads: string[] = [];

beforeAll(async () => {
  // Import from an empty temp dir with NO crucible.config.json present, with
  // process.env instrumented to record any read: proves the import is inert
  // (AD-9 — no config load, no env access at import/registration time).
  originalCwd = process.cwd();
  tempDir = mkdtempSync(join(tmpdir(), 'crucible-inert-'));
  process.chdir(tempDir);
  const realEnv = process.env;
  process.env = new Proxy(realEnv, {
    get(target, prop) {
      if (typeof prop === 'string') {
        envReads.push(prop);
      }
      return Reflect.get(target, prop);
    },
  });
  try {
    ({ crucible } = await import('../index.js'));
  } finally {
    process.env = realEnv;
    process.chdir(originalCwd);
  }
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('crucible namespace — inert import', () => {
  it('imports without a config file and without throwing', () => {
    expect(crucible).toBeDefined();
  });

  it('reads no environment variables at import time', () => {
    expect(envReads).toEqual([]);
  });

  it('exposes the namespace members as functions', () => {
    expect(typeof crucible.it).toBe('function');
    expect(typeof crucible.coherent).toBe('function');
    expect(typeof crucible.load).toBe('function');
  });

  it('is a frozen single namespace (AR11)', () => {
    expect(Object.isFrozen(crucible)).toBe(true);
  });
});

describe('public error surface', () => {
  it('re-exports CrucibleError so consumers can instanceof-catch and read kind', async () => {
    const mod = await import('../index.js');
    expect(mod.CrucibleError).toBe(CrucibleError);
  });
});

describe('crucible namespace — unimplemented members', () => {
  it.each(['it', 'coherent', 'load'] as const)(
    'crucible.%s() throws a usage error on call only',
    (member) => {
      let caught: unknown;
      try {
        crucible[member]();
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(CrucibleError);
      const err = caught as CrucibleError;
      expect(err.kind).toBe('usage');
      expect(err.message).toMatch(/Story 1\.4/);
    },
  );
});
