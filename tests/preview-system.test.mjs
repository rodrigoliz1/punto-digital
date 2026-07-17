import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("preview system defines six real project families and thirteen industries", async () => {
  const [config, templates] = await Promise.all([
    read("config/preview.ts"),
    read("components/preview/preview-templates.tsx"),
  ]);

  for (const project of ["landing", "corporate", "ecommerce", "redesign", "campaign", "portal"]) {
    assert.match(config, new RegExp(`slug: "${project}"`));
  }
  for (const industry of ["professional-services", "medical", "dental", "restaurant", "construction", "real-estate", "architecture", "beauty", "fitness", "education", "retail", "technology", "other"]) {
    assert.match(config, new RegExp(`slug: "${industry}"`));
  }
  for (const renderer of ["LandingPreview", "CorporatePreview", "EcommercePreview", "RedesignPreview", "CampaignPreview", "PortalPreview"]) {
    assert.match(templates, new RegExp(`function ${renderer}`));
  }
});

test("variant pools satisfy the visual system minimums", async () => {
  const config = await read("config/preview.ts");
  assert.match(config, /HERO_VARIANTS = \["split", "centered", "editorial", "layered", "minimal", "immersive"\]/);
  assert.match(config, /NAVIGATION_VARIANTS = \["minimal", "corporate", "commerce", "editorial", "app"\]/);
  assert.match(config, /CARD_VARIANTS = \["solid", "outline", "lifted", "soft", "glass", "media"\]/);
  assert.match(config, /FORM_VARIANTS = \["inline", "card", "split", "floating"\]/);
  assert.match(config, /TESTIMONIAL_VARIANTS = \["quote-grid", "spotlight", "carousel", "avatars", "case-study"\]/);
  assert.match(config, /PRODUCT_VARIANTS = \["catalog-grid", "editorial-list", "featured-split", "compact-rail"\]/);
  assert.match(config, /DASHBOARD_VARIANTS = \["executive", "operations", "crm", "analytics"\]/);
  assert.match(config, /FOOTER_VARIANTS = \["compact", "columns", "cta", "dark", "editorial"\]/);
  assert.match(config, /TYPOGRAPHY_PAIRS = \["modern", "corporate", "editorial", "humanist", "geometric", "luxury", "technical", "friendly"\]/);
});

test("preview persistence, mobile fullscreen and comparison accessibility remain explicit", async () => {
  const [quote, live, beforeAfter, comparisonCss, engine] = await Promise.all([
    read("components/quote-configurator.tsx"),
    read("components/preview/live-preview.tsx"),
    read("components/before-after.tsx"),
    read("app/comparison.css"),
    read("lib/preview-engine.ts"),
  ]);
  assert.match(quote, /pd-quote-session-v2/);
  assert.match(quote, /restored/);
  assert.match(live, /Ver mi página/);
  assert.match(live, /preview_fullscreen_opened/);
  assert.match(beforeAfter, /aria-valuetext/);
  assert.match(beforeAfter, /role="tablist"/);
  assert.match(comparisonCss, /clip-path: inset\(0 0 0 var\(--split\)\)/);
  assert.match(engine, /foregroundFor/);
  assert.match(engine, /Math\.imul/);
});
