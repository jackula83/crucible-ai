const CONFIG_FILE_NAME = 'crucible.config.json';

type ConfigFileRead =
  | { readonly found: true; readonly raw: string }
  | { readonly found: false; readonly reason: 'missing' | 'unreadable'; readonly detail?: string };

type ConfigBoundary = {
  describeSource(): string;
  readConfigFile(): ConfigFileRead;
  readVerbosityOverride(): string | undefined;
};

export { CONFIG_FILE_NAME };
export type { ConfigBoundary, ConfigFileRead };
