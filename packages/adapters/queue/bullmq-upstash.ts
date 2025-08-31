import type { Queue } from "@factory/core/ports";

function notImpl(): never {
  throw new Error("@factory/adapters/queue/bullmq-upstash is not implemented in this scaffold. Set QUEUE_DRIVER=memory or ask to implement the BullMQ adapter.");
}

export const queue: Queue = {
  async enqueue(_name: string, _payload: any) { return notImpl(); },
  process(_name: string, _handler: (payload: any) => Promise<void>) { return notImpl(); }
};

