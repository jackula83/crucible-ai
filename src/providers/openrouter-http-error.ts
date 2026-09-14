class OpenRouterHttpError extends Error {
  constructor(readonly status: number) {
    super(`OpenRouter responded with HTTP ${status}.`);
    this.name = 'OpenRouterHttpError';
  }
}

export { OpenRouterHttpError };
