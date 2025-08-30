import type { Analytics } from "@factory/core/ports";

export const analytics: Analytics = {
  async track(event, props) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, props || {});
  }
};

