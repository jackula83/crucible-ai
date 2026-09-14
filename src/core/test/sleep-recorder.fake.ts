class SleepRecorder {
  waits: number[] = [];

  sleep = (ms: number): Promise<void> => {
    this.waits.push(ms);
    return Promise.resolve();
  };
}

export { SleepRecorder };
