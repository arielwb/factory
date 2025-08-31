import type { Storage } from "@factory/core/ports";

function notImpl(): never {
  throw new Error("@factory/adapters/storage/s3-b2 is not implemented in this scaffold. Set STORAGE_DRIVER=fs or ask to implement the S3/B2 adapter.");
}

export const storage: Storage = {
  async put(_key: string, _body: Buffer, _contentType: string) { return notImpl(); },
  url(_key: string) { return notImpl(); }
};

