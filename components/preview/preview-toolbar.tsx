import { Expand, Monitor, Moon, Palette, RotateCcw, Smartphone, Sparkles, Sun, Tablet, WandSparkles } from "lucide-react";
import type { PreviewColorMode, PreviewDevice } from "@/types";

type PreviewToolbarProps = {
  device: PreviewDevice;
  colorMode: PreviewColorMode;
  onDeviceChange: (device: PreviewDevice) => void;
  onCycleStyle: () => void;
  onCyclePalette: () => void;
  onToggleColorMode: () => void;
  onFullscreen: () => void;
  onReset: () => void;
  fullscreen?: boolean;
};

const devices: Array<{ value: PreviewDevice; label: string; icon: typeof Monitor }> = [
  { value: "desktop", label: "Escritorio", icon: Monitor },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "mobile", label: "Móvil", icon: Smartphone },
];

export function PreviewToolbar({ device, colorMode, onDeviceChange, onCycleStyle, onCyclePalette, onToggleColorMode, onFullscreen, onReset, fullscreen = false }: PreviewToolbarProps) {
  return (
    <div className="pd-preview-toolbar">
      <div className="pd-preview-toolbar__title"><span><Sparkles size={15} /></span><div><strong>Vista preliminar en tiempo real</strong><small>Tu selección se refleja al instante</small></div></div>
      <div className="pd-preview-toolbar__controls">
        <div className="pd-preview-segment" role="group" aria-label="Tamaño del dispositivo">
          {devices.map(({ value, label, icon: Icon }) => <button type="button" key={value} aria-label={`Vista ${label.toLowerCase()}`} aria-pressed={device === value} className={device === value ? "is-active" : ""} onClick={() => onDeviceChange(value)} title={label}><Icon size={16} /><span>{label}</span></button>)}
        </div>
        <div className="pd-preview-tools" role="group" aria-label="Personalizar vista preliminar">
          <button type="button" onClick={onCycleStyle} aria-label="Cambiar estilo" title="Cambiar estilo"><WandSparkles size={16} /></button>
          <button type="button" onClick={onCyclePalette} aria-label="Cambiar paleta" title="Cambiar paleta"><Palette size={16} /></button>
          <button type="button" onClick={onToggleColorMode} aria-label={colorMode === "light" ? "Activar vista oscura" : "Activar vista clara"} aria-pressed={colorMode === "dark"} title={colorMode === "light" ? "Vista oscura" : "Vista clara"}>{colorMode === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
          {!fullscreen && <button type="button" onClick={onFullscreen} aria-label="Abrir pantalla completa" title="Pantalla completa"><Expand size={16} /></button>}
          <button type="button" onClick={onReset} aria-label="Reiniciar vista" title="Reiniciar vista"><RotateCcw size={16} /></button>
        </div>
      </div>
    </div>
  );
}
