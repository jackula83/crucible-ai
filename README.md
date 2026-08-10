# Crucible

A semantic assertion library for stateful systems.

Recently when I was working on one of my AI side projects (which I am calling Proscenium), I had trouble testing its inference capabilities.

Most of what we live with today, i.e. Jest, xUnit, JUnit are deterministic testing. However inference is non-deterministic, and we need a way to test inference.

Proscenium is a storytelling app, where it keeps a world log of events and use a memory management technique to prevent omniscience, which is the #1 killer to long form storytelling.

Using Proscenium and Typescript as an example, the aim is:

```ts
// arrange
const story = await sut.createNewStory("The Long Weekend");
await sut.memory("Bob is at the casino");
await sut.memory("Jane is at home");
crucible.load(story.getLogs());

// act
const response = await sut.input("Jane looks for Bob");

// assert
await expect(response).toMeet(
  crucible.coherence(
    "Jane won't find Bob, because they aren't in the same place",
    { runs: 20, threshold: 0.95 }
  )
);
```

## Alternatives

**[promptfoo](https://www.promptfoo.dev)** is the closest neighbour and the difference is philosophical. Promptfoo is config-first: your test suite is a YAML file, the CLI is the primary surface, and the unit of work is an eval run across a matrix of prompts and providers. Crucible is code-first: the test is a function in your existing test suite, the system under test is your own engine instantiated in-process, and the unit of work is a single assertion inside a red-green loop.

The practical consequence is state. Promptfoo's model is prompt in, output out, assert on the output. You can pass a world log through template variables and a custom rubric prompt, and people do, but it is a workaround rather than a concept the framework has. Crucible treats the world as a first-class input because that is the only way to express whether a character *should* know something.

Worth noting that promptfoo was acquired by OpenAI in March 2026 and is being integrated into their Frontier platform. It remains open source and the team committed to continuity. Its roadmap is enterprise security and red teaming, which is a real need and not this one.

**[DeepEval](https://deepeval.com)** has the strongest metric library going, and G-Eval is a genuinely good primitive. It shipped a TypeScript SDK in July 2026, so the old "Python-only" complaint is out of date. Parity is another matter: LLM-as-a-judge metrics and fully local evaluation still live in the Python package, and the team is refreshingly direct that TypeScript follows Python rather than standing alongside it. That is a reasonable call for them and a bad fit for anyone whose production system is not Python.
