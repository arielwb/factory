export class Breaker {
  private fails = 0;
  constructor(private threshold = 3) {}
  async run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    if (this.fails >= this.threshold) return null;
    try {
      const r = await fn();
      this.fails = 0;
      return r;
    } catch (e) {
      this.fails++;
      return null;
    }
  }
}

