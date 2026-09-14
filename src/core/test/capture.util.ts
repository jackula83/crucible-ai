class Capture {
  static thrown(fn: () => unknown): unknown {
    try {
      fn();
    } catch (error) {
      return error;
    }
    throw new Error('expected the call to throw');
  }

  static async rejection(promise: Promise<unknown>): Promise<unknown> {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    throw new Error('expected the promise to reject');
  }
}

export { Capture };
