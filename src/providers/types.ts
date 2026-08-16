/**
 * Provider port SPEC (AD-8). This is the seam adapters implement — Story 1.2
 * implements src/providers/openrouter.ts against exactly this contract.
 * No provider implementation lives in this story.
 */

/** A single completion request passed to an adapter. */
export interface CompletionRequest {
  /** Model identifier from crucible.config.json. */
  readonly model: string;
  /** The prompt to complete. */
  readonly prompt: string;
  /** Opaque provider passthrough from config `meta` — never validated or transformed. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Classification of a provider failure: retry it, or fail fast. */
export type FailureClass = 'retryable' | 'fatal';

/** The provider adapter port. */
export interface ProviderAdapter {
  /** Registry name this adapter answers to (matches config `provider`). */
  readonly name: string;
  /** Env var the adapter reads its API key from. Keys never live in config. */
  readonly envVar: string;
  /**
   * Perform one completion. Must respect the abort signal: an aborted call
   * rejects with the signal's abort reason. Aborted runs are discarded by the
   * runner (never counted or classified) — classifyFailure is not consulted
   * for abort rejections.
   */
  complete(request: CompletionRequest, signal: AbortSignal): Promise<string>;
  /** Classification hook: decide whether a thrown provider error is retryable or fatal. */
  classifyFailure(error: unknown): FailureClass;
}
