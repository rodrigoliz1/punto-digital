# Prospect OS — arquitectura y decisiones técnicas

Prospect OS es el módulo de adquisición asistida de clientes de Punto Digital. Vive dentro del mismo repositorio, el mismo Worker de Cloudflare, la misma base D1 y el mismo bucket R2 que el sitio comercial. Mercado inicial: Guadalajara y Zapopan.

Principio rector: **los agentes preparan, una persona aprueba y una persona contacta**. El sistema no tiene canal de envío.

## 1. Auditoría del repositorio (resumen)

| Área | Hallazgo | Consecuencia para Prospect OS |
|---|---|---|
| Runtime | Next.js 16 sobre Cloudflare Workers vía vinext (build principal). Build alternativo de Vercel con Webpack. | Todo el código corre en ambos builds; sin APIs exclusivas de Node. |
| Datos | D1 (`DB`) y R2 (`UPLOADS`) declarados en `.openai/hosting.json`. Sites empaqueta `drizzle/` como migraciones. | Una migración aditiva `0001_prospect_os.sql` (solo `CREATE TABLE`/`CREATE INDEX`). |
| Acceso a datos | Las rutas usan D1 directo vía `getD1Binding()` (sin `cloudflare:workers`, por compatibilidad con Vercel). | Mismo patrón; se añadieron `all()`/`batch()` al tipo y el binding R2 al Worker. |
| Identidad (original) | `/admin` confiaba en encabezados `oai-authenticated-user-*`, falsificables si la plataforma no los depura (siempre en Vercel). | **Sustituido** (fase de estabilización): sesión propia del equipo con contraseña + TOTP verificada en servidor. Los encabezados se ignoran salvo `PLATFORM_IDENTITY_HEADERS_TRUSTED=true`, y solo en `/cliente`. |
| Roles | Sin roles. | RBAC propio: propietarios en `ADMIN_EMAIL`, demás roles en `prospect_team`. |
| Nombres | `leads` ya existe (solicitudes del cotizador). | Tablas nuevas con prefijo `prospect_`. |
| Reutilizable | `audit_logs`, `requireJsonRequest` (origen + tamaño), Zod, encabezados de seguridad del Worker, estilos `dashboard-*` y tokens `--pd-*`. | Reutilizados tal cual. |

Del MVP independiente `punto-digital-prospect` (FastAPI/PostgreSQL/n8n) se recuperaron reglas, no tecnología: puntuación determinista donde la evidencia faltante suma 0, deduplicación nombre+ciudad+dominio, gates de estado, supresión que bloquea contacto futuro, demos escapadas con `noindex` y rotuladas como simulación, y ausencia de envío automático.

## 2. Flujo y gates

```
discovered → qualified → demo_ready → approved → contacted → replied → meeting → won / lost
                                                   (cualquier estado) → suppressed (terminal)
```

- `lib/prospect/workflow.ts` define las transiciones. Llegar a `approved`, `contacted`, `replied`, `meeting`, `won` o `lost`, o salir de un estado sensible, exige un **humano con rol de revisor**. Un agente que lo intente recibe `human_required`.
- Toda transición es una actualización condicional (`WHERE status = ?`) más su auditoría, en un solo lote D1. Una guarda transaccional revierte el lote completo si la condición no se cumplió, para que una aprobación concurrente nunca deje efectos a medias (probado en `tests/prospect/service.test.ts`).

## 3. Agentes

| Agente | Implementación | Proveedor | Puede |
|---|---|---|---|
| Investigador | `places.ts` | Google Places API (New) Text Search, con máscara de campos | Crear prospectos `discovered` con fuente, fecha y `place_id` |
| Calificador | `scoring.ts` | Determinista | Puntuar; mover `discovered ↔ qualified` |
| Analista de marca | `website-analyzer.ts` + `ssrf.ts` | Determinista | Leer el sitio público, extraer paleta, redes y correo del dominio |
| Creativo | `brief.ts`, `images.ts` | Determinista o Claude (`claude-opus-5-5`, salida estructurada, `fallbacks: "default"`); imágenes vía adaptador configurable (OpenAI `gpt-image-1`, deshabilitado por defecto) | Crear brief versionado y conceptos ilustrativos en R2 |
| Constructor de demos | `demo.ts` | Determinista | Crear demo privada; mover `qualified → demo_ready` |
| Redacción comercial | `outreach.ts` | Determinista | Crear borradores idempotentes; nunca enviar |
| Supervisor | `reviewer.ts` | Determinista | Bloquear la aprobación si falla un control |

El supervisor verifica: prospecto aprobado, demo aprobada y vigente, sin coincidencia en la lista de supresión, canal comercial publicado (correo del dominio o del registro, nunca proveedores personales), línea de baja, ausencia de cifras/garantías/urgencias falsas, personalización con fuente, un contacto por semana como máximo y límite diario de campaña.

### Orquestación: por qué no n8n, Queues ni Workflows (por ahora)

- **n8n**: implicaría otro servicio expuesto, con SSO/TLS propios, para orquestar llamadas HTTP que ya viven en el Worker. Descartado.
- **Cloudflare Queues / Workflows**: serían la elección natural para lotes grandes o pasos de larga duración, pero el despliegue lo gestiona Sites a partir de `.openai/hosting.json`, que hoy solo declara D1 y R2. Añadir bindings requiere soporte de la plataforma.
- **Decisión**: cada acción de agente es corta (una búsqueda, una lectura de sitio, una llamada al modelo) y se ejecuta en la solicitud, registrada en `prospect_jobs` con clave de idempotencia por clic y hasta 3 reintentos. Cuando el volumen lo justifique, `runJob()` es el punto único donde encolar con Queues sin cambiar la API.

## 4. Seguridad

### Autenticación del equipo (`lib/auth/`)
- **Sin confianza en encabezados.** `/admin`, `/admin/prospectos` y `/api/prospect/*` solo aceptan una cookie de sesión verificada contra D1. Un encabezado de identidad falsificado (`oai-authenticated-user-email`, `x-user-email`, `cf-access-…`) no tiene efecto (cubierto por `tests/auth/routes.test.ts`).
- **Credenciales:** contraseña de 12 caracteres o más (PBKDF2-SHA256, 100 000 iteraciones, el máximo que admite Workers) y **TOTP obligatorio** (RFC 6238, compatible con 1Password, Google Authenticator o Authy). Un código no puede usarse dos veces. El secreto TOTP se guarda cifrado con AES-256-GCM (clave derivada de `AUTH_SECRET`).
- **Sesión:** token aleatorio de 256 bits en la cookie `__Host-pd_staff` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`); en D1 solo se guarda su SHA-256. Caduca a las 12 h (absoluta) o tras 2 h de inactividad, puede revocarse y se invalida al restablecer la contraseña. En `http://localhost` se usa `pd_staff_dev`, que se rechaza en producción.
- **Fuerza bruta:** 5 fallos en 15 minutos bloquean por correo y por IP (`cf-connecting-ip`). El mensaje de error es genérico y, si la cuenta no existe, se verifica un hash ficticio para igualar el tiempo de respuesta.
- **Alta inicial:** `AUTH_SETUP_TOKEN` solo sirve para un correo de `ADMIN_EMAIL` y solo mientras no exista ninguna cuenta. Después, el acceso se obtiene con **invitaciones de un solo uso** (72 h, ligadas al correo); emitir una nueva invalida la anterior. Solo un propietario invita o restablece administradores.
- **Autorización:** el rol se resuelve en cada solicitud (propietario = `ADMIN_EMAIL`; resto = `prospect_team` activo), así que bajas y degradaciones surten efecto de inmediato. Escala: lectura < operador < revisor < administrador < propietario. Sin sesión: 401 en la API y redirección a `/admin/acceso` en páginas; con rol insuficiente: 403 en la API y 404 en páginas.

### Otras protecciones
- **CSRF:** las mutaciones exigen JSON y mismo origen; la cookie es `SameSite=Strict`.
- **Validación:** Zod estricto en cada endpoint; identificadores con formato fijo; los filtros se validan después de autenticar.
- **SSRF:** solo http(s) en los puertos 80 y 443, sin credenciales en la URL. Se rechazan IPs privadas o reservadas (v4/v6, mapeadas y en formatos numéricos alternativos) y hosts internos. El DNS se resuelve por DoH antes de cada salto; las redirecciones son manuales (máximo 3) y se revalidan; hay límites de 8 s, 1.5 MB y tipo MIME.
- **Inyección de prompts:** al modelo solo llegan campos extraídos, delimitados como `<datos_no_confiables>`, y la salida se valida con Zod.
- **Demos:** sin scripts y con todo el contenido escapado; `noindex`, `no-store` y `no-referrer`. Token de 256 bits (en la base solo su hash) que expira a los 14 días, rota al preparar cada envío y se anula al revocar o excluir.
- **Gasto:** se deniega por defecto. Ninguna llamada con costo ocurre sin presupuesto mensual habilitado.
- **Envíos duplicados:** borradores únicos por prospecto, campaña, canal y paso; registrar dos veces el mismo envío responde 409.
- **CSP:** `upgrade-insecure-requests` solo se envía sobre HTTPS.

## 5. Base de datos, respaldo y recuperación

| Migración | Contenido | Tipo |
|---|---|---|
| `0000_little_tana_nile.sql` | Esquema comercial original | Existente |
| `0001_prospect_os.sql` | 14 tablas `prospect_*` | Solo `CREATE TABLE` / `CREATE INDEX` |
| `0002_staff_auth.sql` | 4 tablas `staff_*` | Solo `CREATE TABLE` / `CREATE INDEX` |

`tests/db/migrations.test.ts` impide cualquier migración posterior que no sea aditiva. También aplica las migraciones sobre una base con el seed y filas comerciales, y verifica que datos, esquema previo e integridad no cambien. Además se aplicaron con el motor D1 local de Wrangler en una base temporal: 3 migraciones, 18 tablas nuevas, y reaplicar no hace nada.

**Antes de publicar en producción** (Sites aplica `drizzle/` al publicar):
1. Confirma con la plataforma Sites cómo acceder a la base D1: necesitas exportarla o usar Time Travel. Si no tienes acceso a la cuenta de Cloudflare subyacente, pide a la plataforma su procedimiento de respaldo **antes** de publicar.
2. Si tienes acceso con Wrangler:
   - Respaldo completo: `npx wrangler d1 export <base> --remote --output respaldo-AAAAMMDD.sql`. Guárdalo cifrado; nunca lo compartas sin cifrar.
   - Punto de restauración: `npx wrangler d1 time-travel info <base>` y anota el *bookmark* (D1 conserva 30 días en planes de pago y 7 en el gratuito).
3. Publica. Comprueba `/admin/acceso` y que las páginas comerciales sigan respondiendo.

**Recuperación:**
- Como las migraciones solo agregan tablas, la reversión más segura es **no hacer nada**: las tablas nuevas sin uso no afectan al sitio. Deja `PROSPECT_OS_ENABLED=false`.
- Para volver al estado exacto anterior: `npx wrangler d1 time-travel restore <base> --bookmark=<bookmark>`. Se pierde todo lo escrito después, incluidos pedidos y leads; úsalo solo como último recurso.
- Restauración desde un archivo: crea una base nueva, ejecuta `npx wrangler d1 execute <base-nueva> --remote --file respaldo.sql` y cambia el binding. Ensáyalo primero en una base aislada.

## 6. Ejecutar localmente

```bash
npm ci
cat > .dev.vars <<'VARS'        # ignorado por git
PRIVATE_SURFACES_ENABLED=true
PROSPECT_OS_ENABLED=true
ADMIN_EMAIL=tu-correo@ipunto.digital
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=<32+ caracteres aleatorios>
AUTH_SETUP_TOKEN=<32+ caracteres aleatorios>
VARS
npm run dev                      # http://localhost:3000
# En otra terminal, la primera vez (y tras cada migración nueva):
curl -s localhost:3000/ > /dev/null   # crea la base D1 local si aún no existe
npm run db:migrate:local
```

Para generar los valores aleatorios: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Luego abre `http://localhost:3000/admin/acceso/activar`. Ingresa tu correo (el de `ADMIN_EMAIL`) y el `AUTH_SETUP_TOKEN`, agrega la clave a tu app de autenticación, define tu contraseña y escribe el código. Entrarás a `/admin`, y desde ahí a «Abrir Prospect OS».

**Pruebas:**
- `npm run test:unit`: 40 pruebas de dominio, servicio, autenticación, rutas y migraciones.
- `npm test`: además, el build de Workers y las pruebas de renderizado.
- `npm run lint`, `npm run typecheck` y `npm run build:vercel`.
- `npm run test:e2e`: recorrido en Chrome headless. Requiere el servidor de desarrollo con **una base local recién migrada y sin cuentas**, y las variables `E2E_SETUP_TOKEN` (igual a `AUTH_SETUP_TOKEN`), `E2E_OWNER_EMAIL` (igual a `ADMIN_EMAIL`) y `E2E_BASE_URL` (por ejemplo `http://localhost:3000`). Solo admite localhost.

## 7. Variables de entorno

| Variable | Requerida para | Notas |
|---|---|---|
| `PRIVATE_SURFACES_ENABLED` | `/admin`, `/cliente` | `true` para habilitarlas. |
| `ADMIN_EMAIL` | `/admin` | Propietarios, separados por coma. |
| `AUTH_SECRET` | `/admin` | 32+ caracteres aleatorios. Si cambia, todos deben reactivar su TOTP. Secreto. |
| `AUTH_SETUP_TOKEN` | Primera cuenta | 32+ caracteres. **Elimínalo después de activar la primera cuenta.** Secreto. |
| `PROSPECT_OS_ENABLED` | Prospect OS | `false` por defecto. |
| `GOOGLE_PLACES_API_KEY` | Prospección con Places | Restringe la clave a Places API (New). Secreto. |
| `ANTHROPIC_API_KEY` | Brief con Claude (opcional) | Secreto. |
| `OPENAI_API_KEY` | Imágenes (opcional) | Secreto. |
| `NEXT_PUBLIC_SITE_URL` | Enlaces de demo | `https://www.ipunto.digital` en producción. |
| `PLATFORM_IDENTITY_HEADERS_TRUSTED` | `/cliente` | `false`. Actívalo solo si la plataforma garantiza depurar los encabezados. |

## 8. Activación segura en producción

1. Fusiona la rama tras revisar el PR. Antes de publicar, haz el respaldo descrito en la sección 5.
2. Configura como secretos `AUTH_SECRET`, `AUTH_SETUP_TOKEN` y `ADMIN_EMAIL`, con `PRIVATE_SURFACES_ENABLED=true` y **`PROSPECT_OS_ENABLED=false`**.
3. Publica. En `https://www.ipunto.digital/admin/acceso/activar`, activa la cuenta de propietario.
4. **Elimina `AUTH_SETUP_TOKEN`** y vuelve a publicar.
5. Verifica desde otro navegador sin sesión que `/admin`, `/admin/prospectos` y `/api/prospect/prospects` no den acceso. Envía además el encabezado `oai-authenticated-user-email: <tu correo>` y comprueba que nada cambia.
6. Cambia `PROSPECT_OS_ENABLED=true`. En Configuración, da de alta al equipo con el rol mínimo necesario y comparte las invitaciones por un canal privado.
7. Mantén los presupuestos deshabilitados hasta decidir activar cada proveedor (sección 9).

## 9. Integraciones externas

| Integración | Estado | Para activarla |
|---|---|---|
| Google Places API (New) | Probada con dobles de prueba; **no verificada en vivo** | Clave + presupuesto mensual habilitado en Configuración. Costo estimado de referencia: US$0.035 por búsqueda con campos de contacto (SKU Enterprise); confírmalo en la consola de Google. |
| Claude (brief) | Probado con doble del SDK; **no verificado en vivo** | `ANTHROPIC_API_KEY` + presupuesto. Modelo `claude-opus-5-5`, esfuerzo medio, fallback de servidor. El costo real se registra con los tokens devueltos. |
| Imágenes (OpenAI `gpt-image-1`) | Adaptador sin verificar en vivo | `OPENAI_API_KEY`, proveedor «OpenAI» en el agente Creativo y presupuesto. |
| DNS sobre HTTPS (cloudflare-dns.com) | Verificado en vivo (analista de marca contra example.com) | Sin credenciales. |
| Correo, WhatsApp, Instagram | **No existen**: el envío es manual | Cualquier integración de envío requiere autorización expresa y revisión legal. |

## 10. Primera prospección real en Guadalajara (propuesta)

1. **Antes de empezar:** revisión jurídica (LFPDPPP, aviso de privacidad para prospectos, términos de Google Places), oferta y precios en MXN definidos, y una plantilla de mensaje revisada.
2. **Campaña acotada:** en «Campañas», crea por ejemplo «Cafeterías Providencia — piloto», con límite de 5 contactos diarios.
3. **Descubrimiento con costo mínimo:** habilita Google Places con un presupuesto bajo (por ejemplo US$5 al mes) y haz 1 o 2 búsquedas de 20 resultados (giro + zona).
4. **Selección humana:** de los descubiertos, elige 10 a 15. Ejecuta el análisis del sitio y la calificación, y **completa a mano las señales** que no se pueden observar automáticamente (capacidad de inversión, calidad del producto).
5. **Brief y demo:** usa primero el brief determinista. Activa Claude solo si el determinista no basta, con presupuesto bajo. Revisa cada demo en la vista previa interna antes de aprobarla.
6. **Contacto:** redacta, revisa los controles, aprueba, prepara el texto y envíalo **tú** por el canal comercial publicado. Registra el envío y las respuestas. Atiende cualquier solicitud de baja de inmediato en «Exclusiones».
7. **Medición (2 semanas):** respuestas, reuniones, cierres, costo de API por cliente y tiempo invertido. Decide si continúas o detienes el piloto con esos datos.

## 11. Pendientes conocidos

- Verificar en vivo Google Places, Claude y el proveedor de imágenes, con presupuesto mínimo y tu autorización.
- Límite de solicitudes distribuido en `/propuesta/*` y la API (hoy solo el inicio de sesión tiene bloqueo).
- Vulnerabilidades de herramientas de desarrollo (no llegan al Worker): `@cloudflare/vite-plugin` / `wrangler` / `miniflare` / `undici` / `ws` (corregidas en 1.64.0, publicada hace días), `vite` 8.0 (servidor de desarrollo; afecta sobre todo a Windows), `vinext` 0.0.x (requiere salto a 1.x, mayor), `drizzle-kit` y `eslint-config-next` (los arreglos de `npm audit` proponen retrocesos de versión mayor, no aplicables). `npm audit --omit=dev`: 0.
- Paginación en `applySuppressions` cuando haya miles de prospectos.
- Monitoreo de errores y alertas de gasto.
