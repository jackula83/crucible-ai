import { CrucibleError } from '../core/errors.js';
import { OpenRouterEnvelopeError } from './openrouter-envelope-error.js';
import { OpenRouterHttpError } from './openrouter-http-error.js';
import type { CompletionRequest, FailureClass, ProviderAdapter } from './types.js';

const OPENROUTER_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';
const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 429]);

type ProviderHttpResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};

type ProviderHttpRequestInit = {
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal;
};

type FetchLike = (url: string, init: ProviderHttpRequestInit) => Promise<ProviderHttpResponse>;
type ApiKeyReader = () => string | undefined;

class OpenRouterAdapter implements ProviderAdapter {
  readonly name = 'openrouter';
  readonly envVar = 'OPENROUTER_API_KEY';

  private static readKeyFromEnvironment(): string | undefined {
    return process.env.OPENROUTER_API_KEY;
  }

  constructor(
    private readonly fetchLike: FetchLike = globalThis.fetch,
    private readonly readApiKey: ApiKeyReader = OpenRouterAdapter.readKeyFromEnvironment,
  ) {}

  async complete(request: CompletionRequest, signal: AbortSignal): Promise<string> {
    const key = this.requireApiKey();
    const response = await this.fetchLike(OPENROUTER_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: this.serializeRequestBody(request),
      signal,
    });
    if (!response.ok) {
      throw new OpenRouterHttpError(response.status);
    }
    const envelope = await this.parseEnvelope(response);
    this.rejectEmbeddedError(envelope);
    return this.unwrapCompletionText(envelope);
  }

  classifyFailure(error: unknown): FailureClass {
    if (error instanceof OpenRouterHttpError) {
      return this.isFatalStatus(error.status) ? 'fatal' : 'retryable';
    }
    if (error instanceof CrucibleError) {
      return error.kind === 'infra' && error.retryable === true ? 'retryable' : 'fatal';
    }
    return 'retryable';
  }

  private requireApiKey(): string {
    const key = this.readApiKey()?.trim();
    if (key === undefined || key === '') {
      throw new CrucibleError(
        'config',
        `Set the ${this.envVar} environment variable to your OpenRouter API key.`,
      );
    }
    return key;
  }

  private serializeRequestBody(request: CompletionRequest): string {
    const messages =
      request.system !== undefined
        ? [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ]
        : [{ role: 'user', content: request.prompt }];
    try {
      return JSON.stringify({ ...request.meta, model: request.model, messages });
    } catch (cause) {
      throw new CrucibleError('usage', 'Config meta is not JSON-serializable.', { cause });
    }
  }

  private isFatalStatus(status: number): boolean {
    return status >= 400 && status < 500 && !RETRYABLE_CLIENT_STATUSES.has(status);
  }

  private rejectEmbeddedError(envelope: unknown): void {
    const embedded = (envelope as { error?: unknown })?.error;
    if (embedded === undefined || embedded === null) {
      return;
    }
    const code = (embedded as { code?: unknown }).code;
    if (typeof code === 'number') {
      throw new OpenRouterHttpError(code);
    }
    throw new OpenRouterEnvelopeError();
  }

  private async parseEnvelope(response: ProviderHttpResponse): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new OpenRouterEnvelopeError();
    }
  }

  private unwrapCompletionText(envelope: unknown): string {
    const choices = (envelope as { choices?: unknown })?.choices;
    const first = Array.isArray(choices) ? (choices[0] as unknown) : undefined;
    const content = (first as { message?: { content?: unknown } })?.message?.content;
    if (typeof content !== 'string') {
      throw new OpenRouterEnvelopeError();
    }
    return content;
  }
}

export { OpenRouterAdapter };
export type { ApiKeyReader, FetchLike, ProviderHttpRequestInit, ProviderHttpResponse };
