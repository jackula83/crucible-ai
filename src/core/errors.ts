export type CrucibleErrorKind = 'config' | 'usage' | 'infra';

export interface CrucibleErrorOptions {
  /** Only meaningful for kind 'infra': whether the failure is worth retrying. */
  readonly retryable?: boolean;
  /** Underlying cause (e.g. the provider error for infra failures). */
  readonly cause?: unknown;
}

export class CrucibleError extends Error {
  readonly kind: CrucibleErrorKind;
  /** Set for kind 'infra' (defaults to false); undefined for other kinds. */
  readonly retryable?: boolean;

  constructor(kind: CrucibleErrorKind, message: string, options?: CrucibleErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'CrucibleError';
    this.kind = kind;
    if (kind === 'infra') {
      this.retryable = options?.retryable ?? false;
    }
  }
}
