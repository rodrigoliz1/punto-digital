import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Binding, D1RunResult, D1Statement } from "@/lib/runtime-bindings";

/** Adaptador D1 sobre node:sqlite que aplica las migraciones reales de `drizzle/`. */
export function createTestD1(): D1Binding & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  const dir = new URL("../../drizzle/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(new URL(file, dir), "utf8").split("--> statement-breakpoint")) if (statement.trim()) raw.exec(statement);
  }
  const normalize = (values: unknown[]) => values.map((value) => (value === undefined ? null : typeof value === "boolean" ? Number(value) : value)) as Array<null | number | string>;
  const statement = (sql: string, values: unknown[] = []): D1Statement & { exec(): D1RunResult } => ({
    bind: (...next: unknown[]) => statement(sql, next),
    async first<T>() {
      return (raw.prepare(sql).get(...normalize(values)) as T | undefined) ?? null;
    },
    async all<T>() {
      return { results: raw.prepare(sql).all(...normalize(values)) as T[] };
    },
    async run() {
      return this.exec();
    },
    exec() {
      const prepared = raw.prepare(sql);
      if (/^\s*select/i.test(sql)) {
        prepared.all(...normalize(values));
        return { meta: { changes: 0 } };
      }
      const result = prepared.run(...normalize(values));
      return { meta: { changes: Number(result.changes) } };
    },
  });
  return {
    raw,
    prepare: (sql: string) => statement(sql),
    async batch(statements: D1Statement[]) {
      raw.exec("BEGIN");
      try {
        const results = statements.map((s) => (s as ReturnType<typeof statement>).exec());
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
