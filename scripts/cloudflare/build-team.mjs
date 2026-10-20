/**
 * Compila el Worker del equipo con tus recursos de Cloudflare y valida el paquete con un
 * dry-run. NO despliega: el despliegue es un paso manual posterior (`npx wrangler deploy`).
 * Uso: npm run cf:build:team
 */
import { run, validateTarget } from "./common.mjs";

validateTarget();
run("npm", ["run", "build"], { CF_DEPLOYMENT_ROLE: "team" });
run("npx", ["wrangler", "deploy", "--dry-run"], { WRANGLER_SEND_METRICS: "false" });
console.log(`
Compilación lista y validada (no se desplegó nada).
Revisa arriba que DB, UPLOADS y DEPLOYMENT_ROLE=team apunten a tus recursos.
Para desplegar, cuando lo autorices: npx wrangler deploy`);
