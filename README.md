# Punto Digital

Sitio comercial y plataforma inicial de contratación para **Punto Digital**, una empresa mexicana dedicada al diseño, desarrollo, publicación y mantenimiento de páginas web profesionales.

La aplicación reúne una página comercial premium, experiencias visuales interactivas, un cotizador con preview modular, captura persistente en Cloudflare D1, checkout preparado para Stripe y superficies privadas protegidas para futura conexión de datos por proyecto.

## Requisitos

- Node.js 22.13 o superior
- npm
- Credenciales de Stripe en modo prueba para probar cobros reales
- Los recursos D1 y R2 son administrados por Sites al publicar

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

La aplicación se abre normalmente en `http://localhost:3000`.

## Comandos

```bash
npm run dev          # entorno local
npm run build        # build compatible con Cloudflare Workers
npm run build:vercel # build alternativo con Next.js/Webpack
npm test             # build y pruebas de renderizado
npm run lint         # revisión estática
npm run typecheck    # TypeScript estricto
npm run db:generate  # genera migraciones Drizzle desde db/schema.ts
```

## Arquitectura

- `app/`: rutas públicas, producto, API y metadatos.
- `components/`: experiencia comercial, configurador, onboarding y paneles.
- `config/`: catálogo central de productos, precios, complementos y marca.
- `lib/preview-engine.ts`: motor determinista de preview.
- `db/schema.ts`: modelo relacional para D1.
- `db/seed.sql`: paquetes, complementos y demostraciones conceptuales iniciales.
- `drizzle/`: migraciones reproducibles.
- `public/brand/`: sistema de logotipo SVG e iconos.
- `.openai/hosting.json`: bindings lógicos para D1 (`DB`) y R2 (`UPLOADS`).

## Flujo comercial

1. El visitante explora servicios, demostraciones y paquetes.
2. En `/cotizador` configura proyecto, objetivo, funciones, estilo y datos.
3. El precio se recalcula usando la configuración central, nunca desde un monto confiado al navegador.
4. La solicitud se guarda como prospecto en D1.
5. Si existen Stripe, D1 y webhook, el servidor crea un pedido pendiente y después una sesión de Stripe idempotente. Sin credenciales se utiliza una confirmación de demostración claramente identificada y no se realiza ningún cargo.
6. El webhook valida firma, importe, moneda, producto y complementos antes de registrar el pago y crear el proyecto.
7. Onboarding, portal y administración permanecen cerrados hasta habilitar y completar autorización por recurso.

## Variables de entorno

Copia `.env.example`. Para checkout de prueba son necesarias:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PRIVATE_SURFACES_ENABLED=false
ADMIN_EMAIL=
```

No uses claves de producción durante desarrollo. No expongas `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, claves administrativas ni secretos de correo en variables `NEXT_PUBLIC_*`.

## Base de datos

El modelo incluye prospectos, negocios, cotizaciones, productos, pedidos, pagos, proyectos, onboarding, archivos, contenido y auditoría. Después de modificar `db/schema.ts` ejecuta `npm run db:generate` e inspecciona el SQL generado.

El esquema inicial está en `drizzle/0000_little_tana_nile.sql`. `db/seed.sql` contiene datos conceptuales y precios centrales. Las demostraciones se identifican explícitamente como conceptuales; no existen testimonios ni estadísticas empresariales inventadas.

## Archivos

El binding R2 `UPLOADS` está declarado, pero la API de carga permanece deshabilitada. Antes de habilitarla deben implementarse identidad, autorización por proyecto, validación por firma binaria, sanitización o rechazo de SVG, claves privadas no predecibles y descarga autorizada.

## Stripe y webhooks

`/api/checkout` recalcula el monto del paquete y complementos en el servidor, crea el pedido en D1 y utiliza una clave de idempotencia. `/api/stripe/webhook` verifica la firma HMAC, limita la antigüedad, valida importe y moneda, registra eventos únicos y crea pago/proyecto únicamente para sesiones confirmadas.

Antes de activar producción:

1. Crear productos y precios en Stripe.
2. Configurar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` como secretos.
3. Registrar el endpoint `/api/stripe/webhook`.
4. Ejecutar pagos de prueba de anticipo y total.
5. Probar en Stripe test mode pagos completos, anticipos, métodos asíncronos y reenvío de eventos.

## Seguridad y privacidad

- Validación con Zod en formularios públicos.
- Límites de tamaño y lista permitida de MIME en archivos.
- Precios recalculados en servidor.
- Firma e idempotencia de webhooks.
- CSP, `nosniff`, política de referer y restricciones de permisos.
- Páginas legales marcadas como pendientes de revisión profesional.
- No se solicitan contraseñas mediante campos ordinarios.

Las superficies `/cliente` y `/admin` están cerradas por defecto mediante `PRIVATE_SURFACES_ENABLED=false`. Al habilitarlas requieren identidad proporcionada por la plataforma; `/admin` además exige `ADMIN_EMAIL`. No consultan datos reales todavía porque falta autorización por proyecto/recurso.

## Producción

El despliegue principal es Sites sobre Cloudflare Workers, con D1 (`DB`) y R2 (`UPLOADS`). El dominio canónico es `https://www.ipunto.digital/`. El build alternativo de Vercel se conserva para la superficie pública y usa Webpack; sin bindings D1 los formularios funcionan en modo preliminar y los pagos reales se deshabilitan de forma segura.
# punto-digital
