type CrucibleErrorKind = 'config' | 'usage' | 'infra';

interface CrucibleErrorOptions {
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

class CrucibleError extends Error {
  readonly kind: CrucibleErrorKind;
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

export { CrucibleError };
export type { CrucibleErrorKind, CrucibleErrorOptions };
