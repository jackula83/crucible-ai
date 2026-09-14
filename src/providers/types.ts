type CompletionRequest = {
  readonly model: string;
  readonly system?: string;
  readonly prompt: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

type FailureClass = 'retryable' | 'fatal';

type ProviderAdapter = {
  readonly name: string;
  readonly envVar: string;
  complete(request: CompletionRequest, signal: AbortSignal): Promise<string>;
  classifyFailure(error: unknown): FailureClass;
};

export type { CompletionRequest, FailureClass, ProviderAdapter };
