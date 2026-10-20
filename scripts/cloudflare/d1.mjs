/**
 * Migraciones y respaldos de la D1 del equipo.
 *   npm run cf:d1 -- status                       → lista migraciones pendientes (solo lectura)
 *   npm run cf:d1 -- backup                       → exporta la base a backups/ (no se sube a git)
 *   npm run cf:d1 -- apply --yes-apply-to-remote  → respalda y luego aplica las migraciones
 * Añade --local para ensayar contra la base local del servidor de desarrollo.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { requireEnv, run } from "./common.mjs";

const [command = "status", ...flags] = process.argv.slice(2);
const local = flags.includes("--local");
if (!local) requireEnv(["CF_D1_DATABASE_NAME", "CF_D1_DATABASE_ID"]);
const name = local ? "site-creator-d1" : process.env.CF_D1_DATABASE_NAME;
const id = local ? "00000000-0000-4000-8000-000000000000" : process.env.CF_D1_DATABASE_ID;
// En la raíz del proyecto: Wrangler ubica la base local relativa a este archivo (.wrangler/state).
const config = resolve(".pd-d1-tools.wrangler.json");
process.on("exit", () => rmSync(config, { force: true }));
writeFileSync(config, JSON.stringify({ name: "punto-digital-d1-tools", compatibility_date: "2026-05-15", d1_databases: [{ binding: "DB", database_name: name, database_id: id, migrations_dir: "drizzle" }] }, null, 2));
const target = local ? ["--local"] : ["--remote"];
const env = { WRANGLER_SEND_METRICS: "false", CI: "true" };

function backup() {
  mkdirSync("backups", { recursive: true });
  const file = join("backups", `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
  run("npx", ["wrangler", "d1", "export", name, ...target, "--output", file, "--config", config], env);
  console.log(`Respaldo guardado en ${file}. Guárdalo cifrado; contiene datos personales.`);
}

if (command === "status") run("npx", ["wrangler", "d1", "migrations", "list", name, ...target, "--config", config], env);
else if (command === "backup") backup();
else if (command === "apply") {
  if (!local && !flags.includes("--yes-apply-to-remote")) {
    console.error("Para aplicar en la base remota añade --yes-apply-to-remote (se hará un respaldo antes).");
    process.exit(1);
  }
  backup();
  run("npx", ["wrangler", "d1", "migrations", "apply", name, ...target, "--config", config], env);
} else {
  console.error(`Comando desconocido: ${command}. Usa status, backup o apply.`);
  process.exit(1);
}
