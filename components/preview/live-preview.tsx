"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Info, Sparkles } from "lucide-react";
import { buildPreview } from "@/lib/preview-engine";
import { trackPreviewEvent } from "@/lib/analytics";
import type { PreviewPreferences, QuoteDraft } from "@/types";
import { PreviewDevice } from "@/components/preview/preview-device";
import { PreviewFullscreen } from "@/components/preview/preview-fullscreen";
import { PreviewToolbar } from "@/components/preview/preview-toolbar";
import { PreviewTemplateRenderer, type PreviewInteractionState, type PreviewModal } from "@/components/preview/preview-templates";

type LivePreviewProps = {
  draft: QuoteDraft;
  preferences: PreviewPreferences;
  onPreferencesChange: (preferences: PreviewPreferences) => void;
  onApproveDirection?: () => void;
};

const initialUi: PreviewInteractionState = {
  activeSection: "Inicio",
  mobileMenuOpen: false,
  modal: null,
  cartCount: 0,
  dashboardTab: "Resumen",
  galleryIndex: 0,
  selectedProperty: 0,
  toast: "",
};

export const DEFAULT_PREVIEW_PREFERENCES: PreviewPreferences = { device: "desktop", colorMode: "light", styleOffset: 0, paletteOffset: 0 };

export function LivePreview({ draft, preferences, onPreferencesChange, onApproveDirection }: LivePreviewProps) {
  const [ui, setUi] = useState<PreviewInteractionState>(initialUi);
  const [fullscreen, setFullscreen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const mounted = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const structuralKey = `${draft.projectType}|${draft.industry}|${draft.visualStyle}|${draft.mainGoal}|${[...draft.features].sort().join(",")}|${preferences.styleOffset}|${preferences.paletteOffset}|${preferences.colorMode}`;
  const template = useMemo(() => buildPreview(draft, preferences), [draft, preferences]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setUpdating(true);
    const timer = window.setTimeout(() => setUpdating(false), 480);
    return () => window.clearTimeout(timer);
  }, [structuralKey]);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  function updatePreferences(patch: Partial<PreviewPreferences>) {
    onPreferencesChange({ ...preferences, ...patch });
  }

  function announce(message: string) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setUi((current) => ({ ...current, toast: message }));
    toastTimer.current = window.setTimeout(() => setUi((current) => ({ ...current, toast: "" })), 2200);
  }

  function onDeviceChange(device: PreviewPreferences["device"]) {
    updatePreferences({ device });
    trackPreviewEvent("preview_device_changed", { device });
  }

  function resetPreview() {
    onPreferencesChange(DEFAULT_PREVIEW_PREFERENCES);
    setUi(initialUi);
    announce("Vista preliminar reiniciada.");
  }

  function openFullscreen() {
    setFullscreen(true);
    trackPreviewEvent("preview_fullscreen_opened", { projectType: draft.projectType });
  }

  function handleModal(modal: PreviewModal, message?: string) {
    setUi((current) => ({ ...current, modal }));
    if (message) announce(message);
    if (modal) trackPreviewEvent("preview_cta_clicked", { interaction: modal, projectType: draft.projectType });
  }

  const rendererProps = {
    draft,
    template,
    ui,
    onNavigate: (section: string) => {
      setUi((current) => ({ ...current, activeSection: section, mobileMenuOpen: false }));
      announce(`Vista de ${section.toLowerCase()} activada.`);
      trackPreviewEvent("preview_template_interacted", { interaction: "navigation", section });
    },
    onToggleMenu: () => setUi((current) => ({ ...current, mobileMenuOpen: !current.mobileMenuOpen })),
    onModal: handleModal,
    onAddToCart: () => {
      setUi((current) => ({ ...current, cartCount: current.cartCount + 1 }));
      announce("Producto agregado al carrito de demostración.");
      trackPreviewEvent("preview_template_interacted", { interaction: "cart" });
    },
    onDashboardTab: (dashboardTab: PreviewInteractionState["dashboardTab"]) => {
      setUi((current) => ({ ...current, dashboardTab }));
      announce(`Dashboard ${dashboardTab.toLowerCase()} activado.`);
    },
    onGalleryChange: (galleryIndex: number) => setUi((current) => ({ ...current, galleryIndex })),
    onPropertyChange: (selectedProperty: number) => {
      setUi((current) => ({ ...current, selectedProperty }));
      announce("Propiedad seleccionada.");
    },
  };

  const toolbarProps = {
    device: preferences.device,
    colorMode: preferences.colorMode,
    onDeviceChange,
    onCycleStyle: () => {
      updatePreferences({ styleOffset: (preferences.styleOffset + 1) % 8 });
      trackPreviewEvent("preview_style_changed", { source: "preview_toolbar" });
    },
    onCyclePalette: () => {
      updatePreferences({ paletteOffset: (preferences.paletteOffset + 1) % 3 });
      trackPreviewEvent("preview_style_changed", { source: "palette_toolbar" });
    },
    onToggleColorMode: () => updatePreferences({ colorMode: preferences.colorMode === "light" ? "dark" : "light" }),
    onFullscreen: openFullscreen,
    onReset: resetPreview,
  };

  return (
    <>
      <aside className="live-preview pd-preview-shell" aria-label="Vista preliminar del proyecto">
        <PreviewToolbar {...toolbarProps} />
        <PreviewDevice device={preferences.device} template={template} businessName={draft.businessName} updating={updating}>
          <PreviewTemplateRenderer {...rendererProps} />
        </PreviewDevice>
        <div className="pd-preview-disclaimer"><Info size={14} /><p><strong>Esta es una representación inicial.</strong> El diseño final se personaliza completamente para tu negocio.</p></div>
        <div className="pd-preview-signals"><span><Sparkles size={12} /> Plantilla {template.projectType}</span><span>{template.typographyPair}</span><span>{template.cardVariant}</span></div>
        <button type="button" className="pd-preview-mobile-open" onClick={openFullscreen}><Eye size={17} /> Ver mi página</button>
        <div className={`pd-preview-toast ${ui.toast ? "is-visible" : ""}`} role="status" aria-live="polite">{ui.toast}</div>
      </aside>

      <PreviewFullscreen open={fullscreen} title={`${draft.businessName || "Tu negocio"} · Vista preliminar`} onClose={() => setFullscreen(false)} onApprove={() => { setFullscreen(false); announce("Dirección visual seleccionada."); onApproveDirection?.(); }}>
        <PreviewToolbar {...toolbarProps} fullscreen />
        <PreviewDevice device={preferences.device} template={template} businessName={draft.businessName} updating={updating} fullscreen>
          <PreviewTemplateRenderer {...rendererProps} />
        </PreviewDevice>
      </PreviewFullscreen>
    </>
  );
}
