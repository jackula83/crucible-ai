import { describe, expect, it } from '@jest/globals';
import { SchemaSourceHarness } from './test/schema-source-harness.util.js';

describe('SchemaSource', () => {
  it('loads a schema text from the package schemas directory', () => {
    const { source } = SchemaSourceHarness.source({ '/pkg/schemas/coherent.md': 'schema body' });
    expect(source.load('coherent')).toBe('schema body');
  });

  it('a missing schema file is a config failure', () => {
    const { source } = SchemaSourceHarness.source({});
    expect(SchemaSourceHarness.errorKind(() => source.load('coherent'))).toBe('config');
  });

  it('an empty or whitespace-only schema is a config failure — an empty system prompt would break every judgment', () => {
    const { source } = SchemaSourceHarness.source({ '/pkg/schemas/coherent.md': '   \n ' });
    expect(SchemaSourceHarness.errorKind(() => source.load('coherent'))).toBe('config');
  });

  it('reads each schema from disk once — the file never changes within a process', () => {
    const { source, reads } = SchemaSourceHarness.source({
      '/pkg/schemas/coherent.md': 'schema body',
    });
    source.load('coherent');
    source.load('coherent');
    expect(reads()).toBe(1);
  });
});
