import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

// Despliegue propio en Cloudflare (subdominio del equipo): los identificadores reales llegan como
// variables de build (ver docs/CLOUDFLARE_DEPLOY.md). Sin ellas se conservan los marcadores de Sites
// y del desarrollo local. Ningún secreto va aquí: solo identificadores de recursos y modo de despliegue.
const cloudflareTarget = {
  workerName: process.env.CF_WORKER_NAME,
  d1Name: process.env.CF_D1_DATABASE_NAME ?? "site-creator-d1",
  d1Id: process.env.CF_D1_DATABASE_ID ?? SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
  r2Bucket: process.env.CF_R2_BUCKET_NAME ?? "site-creator-r2",
  teamMode: process.env.CF_DEPLOYMENT_ROLE === "team",
  teamUrl: process.env.CF_TEAM_URL,
};

const localBindingConfig = {
  main: "./worker/index.ts",
  ...(cloudflareTarget.workerName ? { name: cloudflareTarget.workerName } : {}),
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: cloudflareTarget.d1Name,
          database_id: cloudflareTarget.d1Id,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: cloudflareTarget.r2Bucket,
        },
      ]
    : [],
  ...(cloudflareTarget.teamMode
    ? {
        // Modo equipo: solo panel, API privada, acceso y demos; lo público redirige a Vercel.
        vars: {
          DEPLOYMENT_ROLE: "team",
          PUBLIC_SITE_URL: "https://www.ipunto.digital",
          ...(cloudflareTarget.teamUrl ? { PROSPECT_LINK_BASE_URL: cloudflareTarget.teamUrl } : {}),
        },
      }
    : {}),
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
