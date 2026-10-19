export type D1RunResult = { meta?: { changes?: number } };

export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};

export type D1Binding = {
  prepare(query: string): D1Statement;
  /** Ejecuta las sentencias en una sola transacción (semántica de D1). */
  batch(statements: D1Statement[]): Promise<D1RunResult[]>;
};

export type R2ObjectLike = { body: ReadableStream; httpMetadata?: { contentType?: string } };

export type R2Binding = {
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
};

declare global {
  var __PUNTO_DIGITAL_DB__: D1Binding | undefined;
  var __PUNTO_DIGITAL_UPLOADS__: R2Binding | undefined;
}

export function getD1Binding() {
  return globalThis.__PUNTO_DIGITAL_DB__;
}

export function getR2Binding() {
  return globalThis.__PUNTO_DIGITAL_UPLOADS__;
}
