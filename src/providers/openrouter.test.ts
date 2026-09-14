import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { OpenRouterAdapter } from './openrouter.js';
import type { ProviderHttpRequestInit, ProviderHttpResponse } from './openrouter.js';

interface CapturedCall {
  readonly url: string;
  readonly init: ProviderHttpRequestInit;
}

class FakeFetchBoundary {
  readonly calls: CapturedCall[] = [];

  constructor(private readonly respond: () => Promise<ProviderHttpResponse>) {}

  readonly fetchLike = (url: string, init: ProviderHttpRequestInit): Promise<ProviderHttpResponse> => {
    this.calls.push({ url, init });
    if (init.signal.aborted) {
      return Promise.reject(
        init.signal.reason instanceof Error ? init.signal.reason : new Error('aborted'),
      );
    }
    return this.respond();
  };
}

function jsonResponse(status: number, envelope: unknown): () => Promise<ProviderHttpResponse> {
  return () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(envelope),
    });
}

function successEnvelope(text: string): unknown {
  return { choices: [{ message: { content: text } }] };
}

function adapterWith(
  boundary: FakeFetchBoundary,
  keyReader: () => string | undefined = () => 'test-key',
): OpenRouterAdapter {
  return new OpenRouterAdapter(boundary.fetchLike, keyReader);
}

async function failureFrom(adapter: OpenRouterAdapter): Promise<unknown> {
  try {
    await adapter.complete({ model: 'm', prompt: 'p' }, new AbortController().signal);
  } catch (error) {
    return error;
  }
  throw new Error('expected complete() to reject');
}

describe('OpenRouterAdapter completion', () => {
  it('resolves the completion text exactly as the provider returned it', async () => {
    const text = '  VERDICT: coherent\n\nbecause reasons  ';
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(text)));
    const result = await adapterWith(boundary).complete(
      { model: 'openai/gpt-5', prompt: 'judge this' },
      new AbortController().signal,
    );
    expect(result).toBe(text);
  });

  it('posts a bearer-authorized chat-completions request for the given model and prompt', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok')));
    await adapterWith(boundary, () => 'sk-or-abc').complete(
      { model: 'openai/gpt-5', prompt: 'judge this' },
      new AbortController().signal,
    );
    expect(boundary.calls).toHaveLength(1);
    const [call] = boundary.calls;
    expect(call.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(call.init.method).toBe('POST');
    expect(call.init.headers['Authorization']).toBe('Bearer sk-or-abc');
    expect(JSON.parse(call.init.body)).toMatchObject({
      model: 'openai/gpt-5',
      messages: [{ role: 'user', content: 'judge this' }],
    });
  });

  it('spreads meta into the provider request body unmodified', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok')));
    await adapterWith(boundary).complete(
      {
        model: 'openai/gpt-5',
        prompt: 'judge this',
        meta: { provider: 'atlascloud', reasoning: 'minimal' },
      },
      new AbortController().signal,
    );
    const body = JSON.parse(boundary.calls[0].init.body) as Record<string, unknown>;
    expect(body['provider']).toBe('atlascloud');
    expect(body['reasoning']).toBe('minimal');
  });

  it('names openrouter and its key environment variable', () => {
    const adapter = adapterWith(new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok'))));
    expect(adapter.name).toBe('openrouter');
    expect(adapter.envVar).toBe('OPENROUTER_API_KEY');
  });
});

describe('OpenRouterAdapter missing API key', () => {
  it.each([undefined, ''])('fails as config before any network call when the key is %p', async (key) => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok')));
    const error = await failureFrom(adapterWith(boundary, () => key));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('config');
    expect(boundary.calls).toHaveLength(0);
  });
});

describe('OpenRouterAdapter failure classification', () => {
  it.each([429, 408, 500, 502, 503])('classifies HTTP %i as retryable', async (status) => {
    const boundary = new FakeFetchBoundary(jsonResponse(status, {}));
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('retryable');
  });

  it.each([400, 401, 402, 403, 404, 405, 410, 422])('classifies HTTP %i as fatal', async (status) => {
    const boundary = new FakeFetchBoundary(jsonResponse(status, {}));
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('fatal');
  });

  it('classifies network failure as retryable', async () => {
    const boundary = new FakeFetchBoundary(() => Promise.reject(new TypeError('fetch failed')));
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('retryable');
  });

  it('classifies an unparseable response body as retryable', async () => {
    const boundary = new FakeFetchBoundary(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('bad json')),
      }),
    );
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('retryable');
  });

  it.each([
    ['empty object', {}],
    ['empty choices', { choices: [] }],
    ['missing content', { choices: [{ message: {} }] }],
    ['non-string content', { choices: [{ message: { content: 42 } }] }],
  ])('classifies a malformed envelope (%s) as retryable', async (_label, envelope) => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, envelope));
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('retryable');
  });
});

describe('OpenRouterAdapter 200-with-error envelope', () => {
  it('classifies an embedded error with a fatal numeric code as fatal', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, { error: { code: 401 } }));
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('fatal');
  });

  it('classifies an embedded error with a retryable numeric code as retryable', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, { error: { code: 502 } }));
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('retryable');
  });

  it('classifies an embedded error without a numeric code as retryable', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, { error: { message: 'moderated' } }));
    const adapter = adapterWith(boundary);
    expect(adapter.classifyFailure(await failureFrom(adapter))).toBe('retryable');
  });
});

describe('OpenRouterAdapter request-shaping guarantees', () => {
  it('never lets meta clobber the model or messages fields', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok')));
    await adapterWith(boundary).complete(
      {
        model: 'openai/gpt-5',
        prompt: 'judge this',
        meta: { model: 'evil/override', messages: [], routing: 'kept' },
      },
      new AbortController().signal,
    );
    const body = JSON.parse(boundary.calls[0].init.body) as Record<string, unknown>;
    expect(body['model']).toBe('openai/gpt-5');
    expect(body['messages']).toEqual([{ role: 'user', content: 'judge this' }]);
    expect(body['routing']).toBe('kept');
  });

  it('trims whitespace padding from the API key before authorizing', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok')));
    await adapterWith(boundary, () => '  sk-or-padded  ').complete(
      { model: 'm', prompt: 'p' },
      new AbortController().signal,
    );
    expect(boundary.calls[0].init.headers['Authorization']).toBe('Bearer sk-or-padded');
  });

  it('rejects unserializable meta as a usage failure before any network call', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok')));
    const adapter = adapterWith(boundary);
    let caught: unknown;
    try {
      await adapter.complete(
        { model: 'm', prompt: 'p', meta: { big: BigInt(1) as unknown as string } },
        new AbortController().signal,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CrucibleError);
    expect((caught as CrucibleError).kind).toBe('usage');
    expect(boundary.calls).toHaveLength(0);
  });
});

describe('OpenRouterAdapter classification of crucible errors', () => {
  it('respects the retryable flag on infra errors', () => {
    const adapter = adapterWith(new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok'))));
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: true }))).toBe(
      'retryable',
    );
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: false }))).toBe(
      'fatal',
    );
  });

  it('treats config and usage errors as fatal', () => {
    const adapter = adapterWith(new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok'))));
    expect(adapter.classifyFailure(new CrucibleError('config', 'm'))).toBe('fatal');
    expect(adapter.classifyFailure(new CrucibleError('usage', 'm'))).toBe('fatal');
  });
});

describe('OpenRouterAdapter port contract', () => {
  it('rejects when the signal is already aborted', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope('ok')));
    const controller = new AbortController();
    controller.abort();
    await expect(
      adapterWith(boundary).complete({ model: 'm', prompt: 'p' }, controller.signal),
    ).rejects.toBeInstanceOf(Error);
  });
});
