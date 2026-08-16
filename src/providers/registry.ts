import { CrucibleError } from '../core/errors.js';
import type { ProviderAdapter } from './types.js';

/**
 * Provider registry. Resolution is called ONLY by core/config (AD-2) —
 * downstream code receives the resolved adapter via config.get().provider
 * and never touches this module.
 */

const adapters = new Map<string, ProviderAdapter>();

/** Register an adapter singleton under a provider name. Registration is inert (AD-9): it never loads config or env. */
export function register(name: string, adapter: ProviderAdapter): void {
  if (name !== adapter.name) {
    throw new CrucibleError(
      'usage',
      `Registry name "${name}" must match adapter.name "${adapter.name}".`,
    );
  }
  if (adapters.has(name)) {
    throw new CrucibleError('usage', `Provider "${name}" is already registered.`);
  }
  adapters.set(name, adapter);
}

/** Resolve a provider name to its registered adapter singleton. */
export function resolve(name: string): ProviderAdapter {
  const adapter = adapters.get(name);
  if (adapter !== undefined) {
    return adapter;
  }
  const registered = [...adapters.keys()];
  const available =
    registered.length > 0
      ? `Registered providers: ${registered.join(', ')}.`
      : 'No providers are registered.';
  throw new CrucibleError('config', `Unknown provider "${name}". ${available}`);
}

/** Test-only escape hatch: reset registry state between unit tests. Not part of the public API. */
export function clearRegistryForTesting(): void {
  adapters.clear();
}
