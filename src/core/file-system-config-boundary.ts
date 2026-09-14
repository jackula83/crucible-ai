import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE_NAME } from './config-boundary.js';
import type { ConfigBoundary, ConfigFileRead } from './config-boundary.js';

class FileSystemConfigBoundary implements ConfigBoundary {
  describeSource(): string {
    return join(process.cwd(), CONFIG_FILE_NAME);
  }

  readConfigFile(): ConfigFileRead {
    try {
      return { found: true, raw: readFileSync(this.describeSource(), 'utf8') };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
        return { found: false, reason: 'missing' };
      }
      const detail = cause instanceof Error ? cause.message : String(cause);
      return { found: false, reason: 'unreadable', detail };
    }
  }

  readVerbosityOverride(): string | undefined {
    return process.env.CRUCIBLE_VERBOSE;
  }
}

export { FileSystemConfigBoundary };
