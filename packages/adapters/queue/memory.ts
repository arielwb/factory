import type { Queue } from "@factory/core/ports";

const handlers = new Map<string, (payload: any) => Promise<void>>();
const q: Array<{ name: string; payload: any }> = [];

export const queue: Queue = {
  async enqueue(name, payload) {
    q.push({ name, payload });
    const handler = handlers.get(name);
    if (handler) await handler(payload);
  },
  process(name, handler) {
    handlers.set(name, handler);
  }
};

