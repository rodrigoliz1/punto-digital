import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("homepage contains the complete commercial journey", async () => {
  const [page, home, layout] = await Promise.all([
    read("app/page.tsx"),
    read("components/home-page.tsx"),
    read("app/layout.tsx"),
  ]);
  assert.match(page, /<SiteHeader \/>/);
  assert.match(home, /El punto donde comienza/);
  assert.match(home, /<IndustryDemo \/>/);
  assert.match(home, /Demostración conceptual/);
  assert.match(home, /Configurar mi página/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(`${page}${home}${layout}`, /codex-preview|react-loading-skeleton/);
});

test("configurator keeps pricing server-verifiable and previews deterministic", async () => {
  const [configurator, livePreview, products, checkout, preview] = await Promise.all([
    read("components/quote-configurator.tsx"),
    read("components/preview/live-preview.tsx"),
    read("config/products.ts"),
    read("app/api/checkout/route.ts"),
    read("lib/preview-engine.ts"),
  ]);
  assert.match(configurator, /pd-quote-draft/);
  assert.match(configurator, /<LivePreview/);
  assert.match(livePreview, /Vista preliminar/);
  assert.match(products, /price: 7900/);
  assert.match(products, /price: 14900/);
  assert.match(products, /price: 29900/);
  assert.match(checkout, /calculateQuote\(productSlug, addonSlugs\)/);
  assert.doesNotMatch(checkout, /estimatedTotal|clientPrice/);
  assert.match(checkout, /idempotency-key/);
  assert.match(checkout, /INSERT OR IGNORE INTO orders/);
  assert.match(preview, /heroVariant/);
});

test("data and security foundations are present", async () => {
  const [schema, webhook, worker, legal, access, site, upload, admin, client] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/stripe/webhook/route.ts"),
    read("worker/index.ts"),
    read("components/marketing-page.tsx"),
    read("app/access.ts"),
    read("config/site.ts"),
    read("app/api/upload/route.ts"),
    read("app/admin/page.tsx"),
    read("app/cliente/page.tsx"),
  ]);
  assert.match(schema, /webhookEvents/);
  assert.match(schema, /auditLogs/);
  assert.match(webhook, /INSERT OR IGNORE INTO webhook_events/);
  assert.match(webhook, /INSERT OR IGNORE INTO payments/);
  assert.match(webhook, /INSERT OR IGNORE INTO projects/);
  assert.doesNotMatch(webhook, /cloudflare:workers/);
  assert.match(webhook, /crypto\.subtle\.sign/);
  assert.match(webhook, /safeEqual/);
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /strict-transport-security/);
  assert.match(access, /PRIVATE_SURFACES_ENABLED/);
  assert.match(access, /ADMIN_EMAIL/);
  assert.match(site, /https:\/\/www\.ipunto\.digital/);
  assert.match(upload, /carga está deshabilitada/);
  assert.match(admin, /force-dynamic/);
  assert.match(client, /force-dynamic/);
  assert.match(legal, /Pendiente de revisión profesional/);
});
