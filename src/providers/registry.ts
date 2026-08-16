import { CrucibleError } from '../core/errors.js';
import type { ProviderAdapter } from './types.js';

class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(name: string, adapter: ProviderAdapter): void {
    if (name !== adapter.name) {
      throw new CrucibleError(
        'usage',
        `Registry name "${name}" must match adapter.name "${adapter.name}".`,
      );
    }
    if (this.adapters.has(name)) {
      throw new CrucibleError('usage', `Provider "${name}" is already registered.`);
    }
    this.adapters.set(name, adapter);
  }

  resolve(name: string): ProviderAdapter {
    const adapter = this.adapters.get(name);
    if (adapter !== undefined) {
      return adapter;
    }
    throw new CrucibleError('config', `Unknown provider "${name}". ${this.describeRegistered()}`);
  }

  tryResolve(name: string): ProviderAdapter | undefined {
    return this.adapters.get(name);
  }

  private describeRegistered(): string {
    const names = [...this.adapters.keys()];
    return names.length > 0
      ? `Registered providers: ${names.join(', ')}.`
      : 'No providers are registered.';
  }
}

const providerRegistry = new ProviderRegistry();

export { ProviderRegistry, providerRegistry };
