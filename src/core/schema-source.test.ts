import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { SchemaSource } from './schema-source.js';
import { Capture } from './test/capture.harness.js';

class Harness {
  static source(files: Record<string, string>): { source: SchemaSource; reads: () => number } {
    let reads = 0;
    const source = new SchemaSource('/pkg', (path) => {
      reads += 1;
      const text = files[path];
      if (text === undefined) {
        throw new Error('ENOENT');
      }
      return text;
    });
    return { source, reads: () => reads };
  }

  static errorKind(fn: () => unknown): string {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }
}

describe('SchemaSource', () => {
  it('loads a schema text from the package schemas directory', () => {
    const { source } = Harness.source({ '/pkg/schemas/coherent.md': 'schema body' });
    expect(source.load('coherent')).toBe('schema body');
  });

  it('a missing schema file is a config failure', () => {
    const { source } = Harness.source({});
    expect(Harness.errorKind(() => source.load('coherent'))).toBe('config');
  });

  it('an empty or whitespace-only schema is a config failure — an empty system prompt would break every judgment', () => {
    const { source } = Harness.source({ '/pkg/schemas/coherent.md': '   \n ' });
    expect(Harness.errorKind(() => source.load('coherent'))).toBe('config');
  });

  it('reads each schema from disk once — the file never changes within a process', () => {
    const { source, reads } = Harness.source({ '/pkg/schemas/coherent.md': 'schema body' });
    source.load('coherent');
    source.load('coherent');
    expect(reads()).toBe(1);
  });
});
