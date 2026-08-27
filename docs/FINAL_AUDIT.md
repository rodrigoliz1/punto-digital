# Punto Digital — Auditoría final

## Estado general

La superficie comercial, el cotizador, los previews, las rutas legales y los builds soportados quedan en estado presentable y desplegable. Los flujos que todavía requieren identidad o almacenamiento privado permanecen cerrados o degradan de forma explícita; no se presentan como operativos sin garantías server-side.

## Arquitectura final

- Next.js 16.3.0, React 19, TypeScript estricto y CSS propio/Tailwind.
- Vinext/Vite como build principal para Cloudflare Workers.
- Build alternativo de Next.js con Webpack para Vercel.
- Drizzle ORM y Cloudflare D1 para leads, contacto, pedidos, pagos, proyectos y eventos webhook.
- Cloudflare R2 declarado como `UPLOADS`, todavía sin API pública habilitada.
- Catálogo y precios centralizados en `config/products.ts`.
- Preview determinista en `lib/preview-engine.ts`.

## Cambios realizados

- Dominio canónico centralizado en `https://www.ipunto.digital/`.
- Next.js actualizado de 16.2.6 a 16.3.0 para eliminar vulnerabilidades de producción reportadas por npm.
- Dependencia de red de Google Fonts eliminada del build alternativo.
- Rutas privadas protegidas y forzadas a render dinámico.
- APIs públicas con límite de cuerpo, JSON estricto, control de origen y manejo de payload inválido.
- Datos de cotización críticos recalculados en servidor.
- Formularios conectados a D1 cuando el binding está disponible.
- Código de onboarding inseguro/no utilizado retirado.

## Responsive/mobile

- Matriz automatizada revisada en 320, 375, 430, 768, 1024 y 1440 px para home, cotizador, servicios, paquetes, demos, contacto y confirmación.
- Sin scroll horizontal global accidental en las rutas medidas.
- Preloader reducido de 1.35 s a 0.65 s y omitible con target táctil adecuado.
- CTA del preview móvil cambiado de `fixed` invasivo a `sticky` dentro de su sección.
- Fullscreen usa `100dvh` y safe areas en móvil.
- Cotizador móvil conserva una sola columna deliberada y preview a pantalla completa separado.

## Funcionalidad

- Cotizador conserva borrador local, navegación por pasos, preview y recomendación de paquete.
- Leads y contacto persisten en D1 en Cloudflare; fuera de ese runtime responden como preview sin afirmar guardado.
- Checkout crea pedido e items antes de contactar Stripe.
- Confirmación distingue claramente demo de pago enviado.
- Upload, onboarding y datos privados no operan hasta completar controles requeridos.

## Seguridad

- Precios, complementos, anticipo y total se recalculan en servidor.
- Checkout exige UUID por intento y usa `Idempotency-Key` estable.
- Webhook verifica firma, tolerancia temporal, múltiples firmas `v1`, evento, importe y moneda.
- Eventos Stripe se registran de forma idempotente; pagos y proyectos usan inserciones idempotentes.
- `/admin` y `/cliente` están deshabilitados por defecto y requieren identidad server-side al habilitarse.
- `/admin` exige allowlist `ADMIN_EMAIL`.
- Upload deshabilitado hasta contar con ownership, validación binaria y almacenamiento privado.
- Worker añade CSP, `nosniff`, Referrer Policy, Permissions Policy, protección de frames, HSTS en HTTPS y `no-store` para APIs/rutas privadas.
- `npm audit --omit=dev`: 0 vulnerabilidades.

## Performance

- Preloader inicial acortado para no retrasar LCP ni interacción.
- Se eliminó la descarga de Google Fonts durante build; la UI utiliza una pila tipográfica local coherente.
- Animaciones respetan `prefers-reduced-motion`.
- Previews y demos mantienen transformaciones sin provocar scroll horizontal global.

## Accesibilidad

- Menú móvil cierra con Escape, bloquea scroll preservando el estado previo, expone `aria-controls` y vuelve inerte el panel cerrado.
- Focus visible global reforzado.
- Inputs de contacto incluyen `autocomplete`, `inputMode`, tipos correctos y errores con `role="alert"`.
- Before/After conserva range accesible, `aria-valuetext`, tabs móviles y reset.
- Safe areas y targets táctiles mejorados en controles flotantes.

## SEO

- Metadata base, canonical, Open Graph, Twitter, sitemap, robots y datos estructurados usan `https://www.ipunto.digital/`.
- Rutas privadas, onboarding, compra y confirmación permanecen `noindex` cuando corresponde.
- Sitemap contiene únicamente rutas públicas implementadas.

## Tests ejecutados

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm test`: 6/6 pruebas aprobadas.
- Matriz DOM responsive y capturas locales con Chrome headless.
- Crawling estático de enlaces internos y búsqueda de dominios/rutas antiguas.

## Builds ejecutados

- `npm run build`: aprobado con Vinext/Vite/Cloudflare.
- `npm run build:vercel`: aprobado con Next.js 16.3.0 y Webpack.
- `npm run db:generate`: sin cambios de schema ni migraciones nuevas.

## Deployment

- Producción principal: Sites + Cloudflare Workers.
- Bindings esperados: D1 `DB`, R2 `UPLOADS`, assets e imágenes del Worker.
- Vercel se mantiene como build alternativo de superficie pública. Sin D1, no procesa pagos reales ni afirma persistencia.
- No se publicó ni desplegó durante esta auditoría.

## Variables de entorno requeridas

- `NEXT_PUBLIC_SITE_URL`: URL pública; producción `https://www.ipunto.digital`.
- `STRIPE_SECRET_KEY`: secreto server-only, requerido para Stripe.
- `STRIPE_WEBHOOK_SECRET`: secreto server-only, requerido para validar eventos.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: opcional para enlaces de WhatsApp.
- `PRIVATE_SURFACES_ENABLED`: `false` por defecto; solo habilitar con identidad confiable de plataforma.
- `ADMIN_EMAIL`: allowlist separada por comas para administración.

## Integraciones externas

- No se agregaron credenciales ni secretos.
- Correo transaccional y analítica no están conectados en el código actual.
- La identidad privada depende de headers autenticados proporcionados por la plataforma de hosting.

## Stripe

- Flujo implementado en test/production según las claves configuradas.
- Sin `STRIPE_SECRET_KEY`, la UI entra en demo y no crea cargos.
- Con Stripe pero sin D1, checkout responde 503 para evitar pagos sin pedido persistido.
- El webhook procesa `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.async_payment_failed`.
- Falta validar externamente el endpoint con Stripe CLI/test mode y configurar el secreto real en el entorno.

## Cloudflare/D1/R2

- D1 queda conectado a contacto, leads, pedidos, items, webhooks, pagos y proyectos mediante el binding del Worker.
- El esquema y migración existentes cubren esas tablas; no fue necesaria una migración nueva.
- R2 permanece declarado, pero upload/download continúan cerrados hasta implementar autorización y validación de archivos completa.

## Pendientes externos

- Configurar claves Stripe de prueba y registrar el webhook desplegado.
- Definir y probar el proveedor de identidad definitivo para cliente/admin.
- Implementar membresía y autorización por proyecto antes de leer datos privados.
- Diseñar flujo seguro de onboarding con tokens hasheados, expiración, uso único y relación a proyecto.
- Implementar pipeline R2 privado con validación de firma binaria y tratamiento seguro de SVG/PDF.
- Conectar correo de contacto/operación.
- Revisión legal profesional de privacidad, términos, cancelación y reembolsos.
- QA física adicional en Safari iPhone, Chrome Android, Safari macOS, Firefox y Edge.

## Recomendaciones post-lanzamiento

- Monitorizar errores de checkout/webhook y alertar eventos `rejected`, `amount_mismatch` o reintentos persistentes.
- Añadir rate limiting perimetral para contacto, leads y checkout.
- Incorporar pruebas de integración contra D1 local y fixtures de eventos Stripe firmados.
- Medir LCP, CLS e INP con tráfico real antes de ajustar animaciones adicionales.
- Revisar permisos y logs cada vez que se habilite una nueva operación privada.
