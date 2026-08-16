import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CrucibleError } from './errors.js';
import { resolve as resolveProvider } from '../providers/registry.js';
import type { ProviderAdapter } from '../providers/types.js';

/**
 * Config subsystem (AD-9). Nothing at module top level loads config or env —
 * the ONLY load path is the lazy, memoized config.get(), first invoked at
 * first run execution. This module is also the sole env-access point (AR12,
 * besides adapter key lookup in Story 1.2).
 */

const CONFIG_FILE_NAME = 'crucible.config.json';
const VERBOSITY_LEVELS = ['default', 'full', 'debug'] as const;
const KNOWN_FIELDS = ['provider', 'model', 'meta', 'verbosity'] as const;
const KEY_LIKE_FIELDS = ['apikey', 'api_key', 'key', 'token', 'secret', 'authorization'] as const;

export type Verbosity = (typeof VERBOSITY_LEVELS)[number];

export interface CrucibleConfig {
  /** The resolved provider adapter singleton — downstream code never touches the registry. */
  readonly provider: ProviderAdapter;
  readonly model: string;
  /** Opaque provider passthrough — contents never validated or transformed (FR7). */
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly effectiveVerbosity: Verbosity;
}

let cached: CrucibleConfig | undefined;

function configError(message: string): CrucibleError {
  return new CrucibleError('config', message);
}

function readConfigFile(filePath: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw configError(
        `Could not find ${filePath}. Create a ${CONFIG_FILE_NAME} at your project root ` +
          `with at least { "provider": "...", "model": "..." }.`,
      );
    }
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw configError(`Could not read ${filePath} (${detail}).`);
  }
  try {
    // Strip a leading U+FEFF byte-order mark before parsing.
    return JSON.parse(raw.replace(/^\uFEFF/, '')) as unknown;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw configError(`${filePath} is not valid JSON (${detail}). Fix the JSON syntax.`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectKeyLikeFields(root: Record<string, unknown>): void {
  const keyLike = new Set<string>(KEY_LIKE_FIELDS);
  const found = Object.keys(root).find((field) => keyLike.has(field.toLowerCase()));
  if (found === undefined) {
    return;
  }
  let envVarHint = "your provider's API-key environment variable";
  const providerName = root.provider;
  if (typeof providerName === 'string') {
    try {
      envVarHint = `the ${resolveProvider(providerName).envVar} environment variable`;
    } catch {
      // Provider unknown — keep the generic hint; provider validation reports separately.
    }
  }
  throw configError(
    `${CONFIG_FILE_NAME} must never contain API keys: remove "${found}" and set ` +
      `${envVarHint} instead.`,
  );
}

function rejectUnknownFields(root: Record<string, unknown>): void {
  const known = new Set<string>(KNOWN_FIELDS);
  const unknown = Object.keys(root).find((field) => !known.has(field));
  if (unknown !== undefined) {
    throw configError(
      `Unknown field "${unknown}" in ${CONFIG_FILE_NAME}. ` +
        `Allowed fields: ${KNOWN_FIELDS.join(', ')}.`,
    );
  }
}

function validateModel(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw configError(
      `"model" in ${CONFIG_FILE_NAME} must be a non-empty string naming the model to use.`,
    );
  }
  return value;
}

function validateProviderName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw configError(
      `"provider" in ${CONFIG_FILE_NAME} must be a non-empty string naming a registered provider.`,
    );
  }
  return value;
}

function validateMeta(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw configError(`"meta" in ${CONFIG_FILE_NAME} must be an object when present.`);
  }
  return value;
}

function validateVerbosity(value: unknown, source: string): Verbosity {
  if (typeof value === 'string' && (VERBOSITY_LEVELS as readonly string[]).includes(value)) {
    return value as Verbosity;
  }
  throw configError(
    `Invalid verbosity "${String(value)}" from ${source}. ` +
      `Valid levels: ${VERBOSITY_LEVELS.join(', ')}.`,
  );
}

function resolveEffectiveVerbosity(configVerbosity: unknown): Verbosity {
  // A set-but-empty variable (common CI pattern) is treated as unset.
  const fromEnv = process.env.CRUCIBLE_VERBOSE;
  if (fromEnv !== undefined && fromEnv !== '') {
    return validateVerbosity(fromEnv, 'the CRUCIBLE_VERBOSE environment variable');
  }
  if (configVerbosity !== undefined) {
    return validateVerbosity(configVerbosity, `"verbosity" in ${CONFIG_FILE_NAME}`);
  }
  return 'default';
}

function load(): CrucibleConfig {
  const filePath = join(process.cwd(), CONFIG_FILE_NAME);
  const root = readConfigFile(filePath);
  if (!isPlainObject(root)) {
    throw configError(`${filePath} must contain a single JSON object at the root.`);
  }
  rejectKeyLikeFields(root);
  rejectUnknownFields(root);
  const providerName = validateProviderName(root.provider);
  const model = validateModel(root.model);
  const meta = validateMeta(root.meta);
  const effectiveVerbosity = resolveEffectiveVerbosity(root.verbosity);
  const provider = resolveProvider(providerName);
  return Object.freeze({ provider, model, meta, effectiveVerbosity });
}

export const config = {
  /** Load, validate, and memoize crucible.config.json. Fail-fast: all validation happens here, never mid-run. */
  get(): CrucibleConfig {
    cached ??= load();
    return cached;
  },
};

/** Test-only escape hatch: drop the memoized config between unit tests. Not part of the public API. */
export function resetConfigForTesting(): void {
  cached = undefined;
}
