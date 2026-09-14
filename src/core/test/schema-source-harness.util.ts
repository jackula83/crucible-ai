import { expect } from '@jest/globals';
import { CrucibleError } from '../errors.js';
import { SchemaSource } from '../schema-source.js';
import { Capture } from './capture.util.js';

class SchemaSourceHarness {
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

export { SchemaSourceHarness };
