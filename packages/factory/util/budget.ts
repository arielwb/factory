export class RequestBudget {
  private remaining: number;
  constructor(private total: number, private label = 'budget') {
    this.remaining = total;
  }
  consume(n = 1) {
    this.remaining -= n;
    if (this.remaining < 0) {
      throw new Error(`[budget:${this.label}] exceeded total=${this.total}`);
    }
  }
}

