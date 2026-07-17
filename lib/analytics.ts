type PreviewEvent =
  | "preview_project_type_changed"
  | "preview_industry_changed"
  | "preview_style_changed"
  | "preview_device_changed"
  | "preview_fullscreen_opened"
  | "preview_cta_clicked"
  | "preview_template_interacted"
  | "before_after_slider_used"
  | "quote_builder_started"
  | "quote_builder_completed";

export function trackPreviewEvent(event: PreviewEvent, detail: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("punto-digital:analytics", { detail: { event, ...detail } }));
  const dataLayer = (window as typeof window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  dataLayer?.push({ event, ...detail });
}
