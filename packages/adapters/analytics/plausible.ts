import type { Analytics } from "@factory/core/ports";

function notImpl(): never {
  throw new Error("@factory/adapters/analytics/plausible is not implemented in this scaffold. Set ANALYTICS_DRIVER=console or ask to implement the Plausible adapter.");
}

export const analytics: Analytics = {
  async track(_event: string, _props?: Record<string, any>) { return notImpl(); }
};

