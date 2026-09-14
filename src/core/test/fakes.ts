import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';
import type { ConfigBoundary, ConfigFileRead } from '../config.js';

type Attempt = { resolve: string } | { reject: Error };

class ScriptedAdapter implements ProviderAdapter {
  name = 'scripted';
  envVar = 'SCRIPTED_API_KEY';
  calls = 0;

  constructor(
    private attempts: Attempt[],
    private classification: FailureClass,
  ) {}

  complete(request: CompletionRequest, signal: AbortSignal): Promise<string> {
    if (signal.aborted) {
      return Promise.reject(
        signal.reason instanceof Error ? signal.reason : new Error('aborted'),
      );
    }
    const attempt = this.attempts[this.calls];
    if (attempt === undefined) {
      return Promise.reject(new Error('scripted adapter called past its script'));
    }
    this.calls += 1;
    return 'resolve' in attempt ? Promise.resolve(attempt.resolve) : Promise.reject(attempt.reject);
  }

  classifyFailure(): FailureClass {
    return this.classification;
  }
}

class SleepRecorder {
  waits: number[] = [];

  sleep = (ms: number): Promise<void> => {
    this.waits.push(ms);
    return Promise.resolve();
  };
}

class FakeConfigBoundary implements ConfigBoundary {
  fileReads = 0;

  constructor(
    private read: ConfigFileRead,
    private verbosityOverride?: string,
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

export { FakeConfigBoundary, ScriptedAdapter, SleepRecorder };
export type { Attempt };
