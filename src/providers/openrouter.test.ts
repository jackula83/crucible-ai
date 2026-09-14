import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { OpenRouterAdapter } from './openrouter.js';
import {
  FakeFetchBoundary,
  jsonResponse,
  successEnvelope,
  TestModel,
  TEST_API_KEY,
} from './test/fakes.js';

const COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';
const JUDGE_PROMPT = 'judge this';
const RAW_JUDGE_REPLY = '  {"verdict": true, "reasoning": "state and response agree"}\n';
const ROUTING_META = { provider: 'atlascloud', reasoning: 'minimal' };
const PADDED_API_KEY = `  ${TEST_API_KEY}  `;

const adapterWith = (
  boundary: FakeFetchBoundary,
  keyReader: () => string | undefined = () => TEST_API_KEY,
): OpenRouterAdapter => {
  return new OpenRouterAdapter(boundary.fetchLike, keyReader);
};

const failureFrom = async (adapter: OpenRouterAdapter): Promise<unknown> => {
  try {
    await adapter.complete(
      { model: TestModel.Generic, prompt: JUDGE_PROMPT },
      new AbortController().signal,
    );
  } catch (error) {
    return error;
  }
  throw new Error('expected complete() to reject');
};

describe('OpenRouterAdapter completion', () => {
  it('delivers the raw judge reply for core to parse, whitespace preserved', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
    const reply = await adapterWith(boundary).complete(
      { model: TestModel.Gpt5, prompt: JUDGE_PROMPT },
      new AbortController().signal,
    );
    expect(reply).toBe(RAW_JUDGE_REPLY);
  });

  it('sends a bearer-authorized completion request for the given model and prompt', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
    await adapterWith(boundary).complete(
      { model: TestModel.Gpt5, prompt: JUDGE_PROMPT },
      new AbortController().signal,
    );
    expect(boundary.calls).toHaveLength(1);
    const [call] = boundary.calls;
    expect(call.url).toBe(COMPLETIONS_URL);
    expect(call.init.method).toBe('POST');
    expect(call.init.headers['Authorization']).toBe(`Bearer ${TEST_API_KEY}`);
    expect(JSON.parse(call.init.body)).toMatchObject({
      model: TestModel.Gpt5,
      messages: [{ role: 'user', content: JUDGE_PROMPT }],
    });
  });

  it('spreads meta into the provider request body unmodified', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
    await adapterWith(boundary).complete(
      { model: TestModel.Gpt5, prompt: JUDGE_PROMPT, meta: ROUTING_META },
      new AbortController().signal,
    );
    expect(JSON.parse(boundary.calls[0].init.body)).toMatchObject(ROUTING_META);
  });
});

describe('OpenRouterAdapter missing API key', () => {
  it.each([undefined, ''])('fails as config before any network call when the key is %p', async (key) => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
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
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
    await adapterWith(boundary).complete(
      {
        model: TestModel.Gpt5,
        prompt: JUDGE_PROMPT,
        meta: { model: TestModel.DeepseekV3, messages: [], routing: 'kept' },
      },
      new AbortController().signal,
    );
    const body = JSON.parse(boundary.calls[0].init.body) as Record<string, unknown>;
    expect(body['model']).toBe(TestModel.Gpt5);
    expect(body['messages']).toEqual([{ role: 'user', content: JUDGE_PROMPT }]);
    expect(body['routing']).toBe('kept');
  });

  it('trims whitespace padding from the API key before authorizing', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
    await adapterWith(boundary, () => PADDED_API_KEY).complete(
      { model: TestModel.Generic, prompt: JUDGE_PROMPT },
      new AbortController().signal,
    );
    expect(boundary.calls[0].init.headers['Authorization']).toBe(`Bearer ${TEST_API_KEY}`);
  });

  it('rejects unserializable meta as a usage failure before any network call', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
    const adapter = adapterWith(boundary);
    let caught: unknown;
    try {
      await adapter.complete(
        {
          model: TestModel.Generic,
          prompt: JUDGE_PROMPT,
          meta: { big: BigInt(1) as unknown as string },
        },
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
    const adapter = adapterWith(new FakeFetchBoundary(jsonResponse(200, successEnvelope(''))));
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: true }))).toBe(
      'retryable',
    );
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: false }))).toBe(
      'fatal',
    );
  });

  it('treats config and usage errors as fatal', () => {
    const adapter = adapterWith(new FakeFetchBoundary(jsonResponse(200, successEnvelope(''))));
    expect(adapter.classifyFailure(new CrucibleError('config', 'm'))).toBe('fatal');
    expect(adapter.classifyFailure(new CrucibleError('usage', 'm'))).toBe('fatal');
  });
});

describe('OpenRouterAdapter port contract', () => {
  it('rejects when the signal is already aborted', async () => {
    const boundary = new FakeFetchBoundary(jsonResponse(200, successEnvelope(RAW_JUDGE_REPLY)));
    const controller = new AbortController();
    controller.abort();
    await expect(
      adapterWith(boundary).complete(
        { model: TestModel.Generic, prompt: JUDGE_PROMPT },
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(Error);
  });
});
