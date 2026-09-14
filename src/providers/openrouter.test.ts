import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { Capture } from '../core/test/capture.harness.js';
import { OpenRouterAdapter } from './openrouter.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { TestModel } from './test/test-model.enum.js';

const JUDGE_PROMPT = 'judge this';
const RAW_JUDGE_REPLY = '  {"verdict": true, "reasoning": "state and response agree"}\n';
const TEST_API_KEY = 'sk-or-test';

class Harness {
  static adapter(
    boundary: FakeFetchBoundary,
    keyReader: () => string | undefined = () => TEST_API_KEY,
  ): OpenRouterAdapter {
    return new OpenRouterAdapter(boundary.fetchLike, keyReader);
  }

  static complete(adapter: OpenRouterAdapter): Promise<string> {
    return adapter.complete(
      { model: TestModel.Generic, prompt: JUDGE_PROMPT },
      new AbortController().signal,
    );
  }

  static failure(adapter: OpenRouterAdapter): Promise<unknown> {
    return Capture.rejection(Harness.complete(adapter));
  }
}

describe('OpenRouterAdapter completion', () => {
  it('delivers the raw judge reply for core to parse, whitespace preserved', async () => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    await expect(Harness.complete(Harness.adapter(boundary))).resolves.toBe(RAW_JUDGE_REPLY);
  });
});

describe('OpenRouterAdapter missing API key', () => {
  it.each([undefined, ''])('fails as config when the key is %p', async (key) => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    const error = await Harness.failure(Harness.adapter(boundary, () => key));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('config');
  });
});

describe('OpenRouterAdapter failure classification', () => {
  it.each([429, 408, 500, 502, 503])('classifies HTTP %i as retryable', async (status) => {
    const adapter = Harness.adapter(FakeFetchBoundary.respondingWith(status, {}));
    expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('retryable');
  });

  it.each([400, 401, 402, 403, 404, 405, 410, 422])(
    'classifies HTTP %i as fatal',
    async (status) => {
      const adapter = Harness.adapter(FakeFetchBoundary.respondingWith(status, {}));
      expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('fatal');
    },
  );

  it('classifies network failure as retryable', async () => {
    const adapter = Harness.adapter(FakeFetchBoundary.failing(new TypeError('fetch failed')));
    expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('retryable');
  });

  it('classifies an unparseable response body as retryable', async () => {
    const adapter = Harness.adapter(FakeFetchBoundary.withUnparseableBody());
    expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('retryable');
  });

  it.each([
    ['empty object', {}],
    ['empty choices', { choices: [] }],
    ['missing content', { choices: [{ message: {} }] }],
    ['non-string content', { choices: [{ message: { content: 42 } }] }],
  ])('classifies a malformed envelope (%s) as retryable', async (_label, envelope) => {
    const adapter = Harness.adapter(FakeFetchBoundary.respondingWith(200, envelope));
    expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('retryable');
  });
});

describe('OpenRouterAdapter 200-with-error envelope', () => {
  it('classifies an embedded error with a fatal numeric code as fatal', async () => {
    const adapter = Harness.adapter(
      FakeFetchBoundary.respondingWith(200, { error: { code: 401 } }),
    );
    expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('fatal');
  });

  it('classifies an embedded error with a retryable numeric code as retryable', async () => {
    const adapter = Harness.adapter(
      FakeFetchBoundary.respondingWith(200, { error: { code: 502 } }),
    );
    expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('retryable');
  });

  it('classifies an embedded error without a numeric code as retryable', async () => {
    const adapter = Harness.adapter(
      FakeFetchBoundary.respondingWith(200, { error: { message: 'moderated' } }),
    );
    expect(adapter.classifyFailure(await Harness.failure(adapter))).toBe('retryable');
  });
});

describe('OpenRouterAdapter invalid usage', () => {
  it('rejects unserializable meta as a usage failure', async () => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    const error = await Capture.rejection(
      Harness.adapter(boundary).complete(
        {
          model: TestModel.Generic,
          prompt: JUDGE_PROMPT,
          meta: { big: BigInt(1) as unknown as string },
        },
        new AbortController().signal,
      ),
    );
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });
});

describe('OpenRouterAdapter classification of crucible errors', () => {
  it('respects the retryable flag on infra errors', () => {
    const adapter = Harness.adapter(FakeFetchBoundary.respondingWith(200, {}));
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: true }))).toBe(
      'retryable',
    );
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: false }))).toBe(
      'fatal',
    );
  });

  it('treats config and usage errors as fatal', () => {
    const adapter = Harness.adapter(FakeFetchBoundary.respondingWith(200, {}));
    expect(adapter.classifyFailure(new CrucibleError('config', 'm'))).toBe('fatal');
    expect(adapter.classifyFailure(new CrucibleError('usage', 'm'))).toBe('fatal');
  });
});

describe('OpenRouterAdapter port contract', () => {
  it('rejects when the signal is already aborted', async () => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      Harness.adapter(boundary).complete(
        { model: TestModel.Generic, prompt: JUDGE_PROMPT },
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(Error);
  });
});
