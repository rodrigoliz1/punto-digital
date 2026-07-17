"use client";
import { RefreshCcw } from "lucide-react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="state-page"><span>Algo no salió como esperábamos</span><h1>Perdimos la conexión entre dos puntos.</h1><p>Tu información local sigue guardada. Intenta cargar esta sección de nuevo.</p><button className="button" onClick={reset}><RefreshCcw size={17} />Intentar de nuevo</button></main>; }
