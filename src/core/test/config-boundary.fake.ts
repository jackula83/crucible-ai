import type { ConfigBoundary, ConfigFileRead } from '../config.js';

class FakeConfigBoundary implements ConfigBoundary {
  constructor(
    private read: ConfigFileRead,
    private verbosityOverride?: string,
  ) {}

  describeSource(): string {
    return 'fake://crucible.config.json';
  }

  readConfigFile(): ConfigFileRead {
    return this.read;
  }

  readVerbosityOverride(): string | undefined {
    return this.verbosityOverride;
  }
}

export { FakeConfigBoundary };
