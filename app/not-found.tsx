import Link from "next/link";
import { ArrowLeft } from "lucide-react";
export default function NotFound() { return <main className="state-page"><span>Error 404</span><h1>Este punto no existe.</h1><p>La página pudo cambiar de lugar o nunca estuvo aquí. Volvamos a un punto conocido.</p><Link href="/" className="button"><ArrowLeft size={17} />Volver al inicio</Link></main>; }
