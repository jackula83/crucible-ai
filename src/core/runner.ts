import { RunScope, runScope } from './state.js';

class Runner {
  constructor(private readonly scope: RunScope = runScope) {}

  execute<T>(body: () => Promise<T> | T): Promise<T> {
    return this.scope.enterRun(async () => body());
  }
}

export { Runner };
