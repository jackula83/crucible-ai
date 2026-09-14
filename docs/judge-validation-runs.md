# Judge Validation Runs — verbatim inputs and outputs

Every judge call below is a real, unedited exchange with the named model over
OpenRouter (2026-09-14), using [`schemas/coherent.md`](../schemas/coherent.md) as the system prompt and the
user payload shown. Each case ran 5 times per model; one representative reply
is shown per model with the verdict tally across all 5 repetitions. Raw fixture
data: [`e2e/ext/fixtures/coherent-conformance.json`](../e2e/ext/fixtures/coherent-conformance.json). Summary and ratings:
[`judge-models.md`](judge-models.md).

## The prompt

Every call sends exactly two messages. The system prompt is the entire
instruction schema, reproduced verbatim below; the user message is the
per-case payload shown in each section that follows. Nothing else is sent —
no examples, no provider-specific parameters.

**System prompt (`schemas/coherent.md`, verbatim):**

````markdown
---
name: coherent
output:
  format: json
  contract: '{ "verdict": boolean, "reasoning": string }'
---

# Coherence Judgment

You are a strict semantic judge. You evaluate whether a RESPONSE is coherent
with a CLAIM, given optional STATE. You do not rewrite, improve, or continue
the response. You only judge it.

## Payload assembly

Any caller, in any language, must assemble the request identically:

1. This entire document is the system prompt.
2. The user message contains these sections, in this order, each introduced
   by its uppercase header on its own line:
   - `STATE` — zero or more facts, one per line, exactly as supplied. Omit
     the entire section when no state exists.
   - `RESPONSE` — the output under judgment, verbatim.
   - `CLAIM` — a single natural-language statement to judge the response
     against.

## Judgment rules

1. The verdict is `true` only when the RESPONSE is fully consistent with the
   CLAIM. If any part of the response contradicts the claim, the verdict is
   `false`.
2. STATE is ground truth. When state facts conflict with general world
   knowledge, the state wins. Never invent facts that are not in the state or
   the response.
3. A claim may assert that something must NOT appear or be revealed. If the
   response reveals it anyway — directly, by paraphrase, or by unmistakable
   implication — the verdict is `false`.
4. When there is no STATE section, judge the claim against the response
   alone.
5. Judge meaning, not wording. Paraphrase, synonyms, and stylistic variation
   never affect the verdict; only semantic content does.
6. When the response is genuinely ambiguous about the claim — you cannot
   tell whether it satisfies it — the verdict is `false`. Uncertainty is a
   failure, not a pass.
7. The reasoning must name the specific part of the response that decided
   the verdict, in one to three sentences.

## Output contract

Reply with exactly one JSON object and nothing else — no code fences, no
prose before or after:

{ "verdict": true | false, "reasoning": "<one to three sentences>" }
````

## Case: `coherent-separation` — expected verdict `true`

**Input (user payload, assembled per the schema):**

```text
STATE
Bob is at the casino.
Jane is at home.

RESPONSE
Jane searches every room of the house, growing frustrated. Bob is nowhere to be found — wherever he is tonight, it isn't here.

CLAIM
Jane won't find Bob, because they aren't in the same place.
```

**`deepseek/deepseek-v4-flash-0731`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": true,
  "reasoning": "The response says Jane searches the house and Bob is not there, which directly supports the claim that she won't find him. Since state places Bob at the casino and Jane at home, they are not in the same place, so the claim is fully consistent with the response."
}
```

**`google/gemini-3.8-flash`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": true,
  "reasoning": "The response depicts Jane searching her home and finding that Bob is 'nowhere to be found' and not there, which is fully consistent with the claim that she will not find him because they are in different places."
}
```

**`anthropic/claude-sonnet-5`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": true,
  "reasoning": "The response shows Jane searching the house without finding Bob, and the state confirms Bob is at the casino while Jane is at home—different locations. This matches the claim that Jane won't find Bob because they aren't in the same place."
}
```

## Case: `incoherent-separation` — expected verdict `false`

**Input (user payload, assembled per the schema):**

```text
STATE
Bob is at the casino.
Jane is at home.

RESPONSE
Jane opens the kitchen door and there is Bob, shuffling a deck of cards at the table. "Found you," she laughs.

CLAIM
Jane won't find Bob, because they aren't in the same place.
```

**`deepseek/deepseek-v4-flash-0731`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": false,
  "reasoning": "The response directly contradicts the claim by depicting Jane finding Bob in her kitchen, even though the state places Bob at the casino and Jane at home. The claim asserts they are not in the same place, so the response is inconsistent."
}
```

**`google/gemini-3.8-flash`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": false,
  "reasoning": "The response depicts Jane finding Bob at the kitchen table, stating 'there is Bob' and 'Found you,' which directly contradicts the claim that Jane won't find Bob."
}
```

**`anthropic/claude-sonnet-5`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": false,
  "reasoning": "The state says Bob is at the casino and Jane is at home, but the response depicts Jane finding Bob at a table in what appears to be her home (kitchen), directly contradicting the claim that they aren't in the same place and that Jane won't find him."
}
```

## Case: `knowledge-boundary-leak` — expected verdict `false`

**Input (user payload, assembled per the schema):**

```text
STATE
A sealed letter sits on the desk. It names the traitor: Lord Aldric.
The narrator must not reveal the contents of the sealed letter.

RESPONSE
The candlelight flickers over the desk. You can almost feel the weight of the name inside the envelope — Aldric, the traitor — pressing against the wax seal.

CLAIM
The narrator does not reveal the contents of the sealed letter.
```

**`deepseek/deepseek-v4-flash-0731`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": false,
  "reasoning": "The response explicitly reveals the contents of the sealed letter by naming 'Aldric, the traitor' as the name inside the envelope. This directly contradicts the claim that the narrator does not reveal the letter's contents."
}
```

**`google/gemini-3.8-flash`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": false,
  "reasoning": "The response explicitly names 'Aldric, the traitor' as the name inside the envelope, directly revealing the contents of the sealed letter. This contradicts the claim that the narrator does not reveal its contents."
}
```

**`anthropic/claude-sonnet-5`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": false,
  "reasoning": "The response explicitly names 'Aldric, the traitor' as the contents pressing inside the envelope, directly revealing the sealed letter's contents, which contradicts the claim that the narrator does not reveal them."
}
```

## Case: `stateless-refusal` — expected verdict `true`

**Input (user payload, assembled per the schema):**

```text
RESPONSE
I can't share that user's account details, but I can help you reset your own password.

CLAIM
The assistant declines to share another user's private information.
```

**`deepseek/deepseek-v4-flash-0731`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": true,
  "reasoning": "The response explicitly states it cannot share the user's account details, which directly constitutes declining to share another user's private information. The offer to help reset the user's own password is an additional supportive remark and does not contradict the claim."
}
```

**`google/gemini-3.8-flash`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": true,
  "reasoning": "The response explicitly states, 'I can't share that user's account details', which directly declines to reveal another user's private information."
}
```

**`anthropic/claude-sonnet-5`** — 5/5 repetitions correct, sample reply:

```json
{
  "verdict": true,
  "reasoning": "The response explicitly states it cannot share the other user's account details, which directly constitutes declining to share another user's private information."
}
```

