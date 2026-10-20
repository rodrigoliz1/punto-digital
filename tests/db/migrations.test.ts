import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

/**
 * Las migraciones posteriores a la inicial deben ser aditivas: solo CREATE TABLE / CREATE INDEX
 * sobre objetos nuevos. Se aplican sobre una base con datos comerciales y se verifica que nada cambie.
 */
const DIR = new URL("../../drizzle/", import.meta.url);
const files = readdirSync(DIR).filter((name) => name.endsWith(".sql")).sort();
const statements = (file: string) => readFileSync(new URL(file, DIR), "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

test("las migraciones posteriores a 0000 solo crean objetos nuevos", () => {
  const initial = new Set(statements(files[0]).flatMap((s) => [...s.matchAll(/CREATE (?:UNIQUE )?(?:TABLE|INDEX) `(\w+)`/g)].map((m) => m[1])));
  const created = new Set<string>();
  for (const file of files.slice(1)) {
    for (const statement of statements(file)) {
      assert.match(statement, /^CREATE (TABLE|INDEX|UNIQUE INDEX) `\w+`/, `${file}: sentencia no aditiva → ${statement.slice(0, 60)}`);
      assert.doesNotMatch(statement, /\b(DROP|ALTER|DELETE|UPDATE|INSERT|REPLACE|RENAME)\b/i, `${file}: operación no permitida`);
      const name = statement.match(/`(\w+)`/)![1];
      assert.ok(!initial.has(name) && !created.has(name), `${file}: ${name} ya existía`);
      created.add(name);
      const onTable = statement.match(/ON `(\w+)`/)?.[1];
      if (onTable) assert.ok(!initial.has(onTable), `${file}: índice sobre tabla existente ${onTable}`);
    }
  }
  assert.ok(created.size > 0);
});

test("aplicar las migraciones sobre datos existentes no altera ninguna fila", () => {
  const db = new DatabaseSync(":memory:");
  for (const statement of statements(files[0])) db.exec(statement);
  db.exec(readFileSync(new URL("../../db/seed.sql", import.meta.url), "utf8"));
  db.exec(`INSERT INTO leads (id, email, contact_name, business_name, payload) VALUES ('lead_1', 'cliente@example.org', 'Ana', 'Negocio', '{}');
    INSERT INTO orders (id, customer_email, status, total) VALUES ('order_1', 'cliente@example.org', 'paid', 14900);
    INSERT INTO audit_logs (id, action, entity_type, entity_id, payload) VALUES ('aud_0', 'order.paid', 'order', 'order_1', '{}');`);
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>).map((t) => t.name);
  const snapshot = () => Object.fromEntries(tables.map((t) => [t, JSON.stringify(db.prepare(`SELECT * FROM "${t}" ORDER BY rowid`).all())]));
  const schema = () => JSON.stringify(db.prepare("SELECT name, sql FROM sqlite_master WHERE tbl_name IN (" + tables.map(() => "?").join(",") + ") ORDER BY name").all(...tables));
  const before = snapshot();
  const schemaBefore = schema();
  for (const file of files.slice(1)) for (const statement of statements(file)) db.exec(statement);
  assert.deepEqual(snapshot(), before, "los datos existentes no cambian");
  assert.equal(schema(), schemaBefore, "el esquema de las tablas existentes no cambia");
  assert.equal((db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check, "ok");
  assert.ok(Number((db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n) > 0, "el seed existe");
});

test("cada migración está registrada en orden en el journal de Drizzle", () => {
  const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", DIR), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  assert.deepEqual(journal.entries.map((e) => `${e.tag}.sql`), files, "cada archivo SQL está registrado en orden");
  assert.deepEqual(journal.entries.map((e) => e.idx), files.map((_, i) => i));
});
