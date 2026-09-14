class OpenRouterEnvelopeError extends Error {
  constructor() {
    super('OpenRouter response envelope did not contain completion text.');
    this.name = 'OpenRouterEnvelopeError';
  }
}

export { OpenRouterEnvelopeError };
