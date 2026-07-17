# Punto Digital

Sitio comercial y plataforma inicial de contratación para **Punto Digital**, una empresa mexicana dedicada al diseño, desarrollo, publicación y mantenimiento de páginas web profesionales.

La aplicación reúne una página comercial premium, experiencias visuales interactivas, un cotizador con preview modular, captura persistente de prospectos, checkout preparado para Stripe, onboarding, portal de cliente y panel administrativo inicial.

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
npm test             # build y pruebas de renderizado
npm run lint         # revisión estática
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
5. Si existen credenciales de Stripe, el servidor crea Stripe Checkout; sin credenciales se utiliza una confirmación de demostración claramente identificada y no se realiza ningún cargo.
6. El onboarding utiliza un token de proyecto y el portal organiza avances, archivos, pagos y comentarios.

## Variables de entorno

Copia `.env.example`. Para checkout de prueba son necesarias:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

No uses claves de producción durante desarrollo. No expongas `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, claves administrativas ni secretos de correo en variables `NEXT_PUBLIC_*`.

## Base de datos

El modelo incluye prospectos, negocios, cotizaciones, productos, pedidos, pagos, proyectos, onboarding, archivos, contenido y auditoría. Después de modificar `db/schema.ts` ejecuta `npm run db:generate` e inspecciona el SQL generado.

El esquema inicial está en `drizzle/0000_little_tana_nile.sql`. `db/seed.sql` contiene datos conceptuales y precios centrales. Las demostraciones se identifican explícitamente como conceptuales; no existen testimonios ni estadísticas empresariales inventadas.

## Archivos

Los binarios se almacenan en R2 mediante el binding `UPLOADS`. La API limita tamaño a 10 MB y acepta PNG, JPEG, WebP, SVG y PDF. La metadata relacional puede vincularse en D1 con `project_files`. Antes de producción, conecta la identidad del usuario y valida pertenencia al proyecto en el servidor.

## Stripe y webhooks

`/api/checkout` recalcula el monto del paquete y complementos en el servidor. `/api/stripe/webhook` verifica la firma HMAC, limita la antigüedad del evento y registra el identificador único en `webhook_events` para evitar doble procesamiento.

Antes de activar producción:

1. Crear productos y precios en Stripe.
2. Configurar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` como secretos.
3. Registrar el endpoint `/api/stripe/webhook`.
4. Ejecutar pagos de prueba de anticipo y total.
5. Completar la creación del pedido/proyecto a partir de eventos confirmados.

## Seguridad y privacidad

- Validación con Zod en formularios públicos.
- Límites de tamaño y lista permitida de MIME en archivos.
- Precios recalculados en servidor.
- Firma e idempotencia de webhooks.
- CSP, `nosniff`, política de referer y restricciones de permisos.
- Páginas legales marcadas como pendientes de revisión profesional.
- No se solicitan contraseñas mediante campos ordinarios.

Los paneles incluidos son una primera superficie visual. Antes de manejar datos reales de clientes o administradores, debe conectarse autenticación y autorización de producción en todas las lecturas y escrituras.

## Producción

El sitio está preparado para Sites y Cloudflare Workers. El dominio canónico objetivo es `https://punto-digital.mx`. Antes de enlazarlo completa Stripe, correo, analítica, documentos legales, políticas de acceso y pruebas de navegación en dispositivos reales.
