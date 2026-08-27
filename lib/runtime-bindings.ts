export type D1RunResult = { meta?: { changes?: number } };

export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
};

export type D1Binding = {
  prepare(query: string): D1Statement;
};

declare global {
  var __PUNTO_DIGITAL_DB__: D1Binding | undefined;
}

export function getD1Binding() {
  return globalThis.__PUNTO_DIGITAL_DB__;
}
