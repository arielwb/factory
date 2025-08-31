import type { Poster } from "@factory/core/ports";

function notImpl(): never {
  throw new Error("@factory/adapters/poster/twitter is not implemented in this scaffold. Set POSTER_DRIVER=mock or ask to implement the Twitter adapter.");
}

export const poster: Poster = {
  async planPost(_input) { return notImpl(); }
};

