import { spawnSync } from "node:child_process";

export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`Faltan valores en cloudflare/equipo.env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

export function validateTarget() {
  requireEnv(["CF_WORKER_NAME", "CF_D1_DATABASE_NAME", "CF_D1_DATABASE_ID", "CF_R2_BUCKET_NAME", "CF_TEAM_URL"]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(process.env.CF_D1_DATABASE_ID) || /^0{8}-/.test(process.env.CF_D1_DATABASE_ID)) {
    console.error("CF_D1_DATABASE_ID no parece un identificador real de D1 (formato UUID).");
    process.exit(1);
  }
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(process.env.CF_TEAM_URL)) {
    console.error("CF_TEAM_URL debe ser https://… sin ruta final (por ejemplo https://equipo.ipunto.digital).");
    process.exit(1);
  }
  if (/^https:\/\/(www\.)?ipunto\.digital$/i.test(process.env.CF_TEAM_URL)) {
    console.error("CF_TEAM_URL no puede ser el sitio público.");
    process.exit(1);
  }
}

export function run(command, args, extraEnv = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
  // process.exit dispara los manejadores "exit" (limpieza de archivos temporales).
  if (result.status !== 0) process.exit(result.status ?? 1);
}
