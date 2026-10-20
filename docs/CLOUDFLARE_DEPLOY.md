# Despliegue de Prospect OS en Cloudflare (subdominio del equipo)

Arquitectura elegida:

- **`www.ipunto.digital`** se queda en **Vercel**, sin cambios.
- **Prospect OS** se despliega aparte en un **Worker de Cloudflare de tu propia cuenta**, con su base **D1** y su almacenamiento **R2**. Al principio vivirá en una dirección `workers.dev`; después, en `equipo.ipunto.digital`.

> Nada de este documento se ha ejecutado contra tu cuenta. No se crearon recursos, no se desplegó nada y no se tocó el DNS.

## 1. Viabilidad comprobada

| Verificación | Resultado |
|---|---|
| Compilación del Worker con tus recursos (IDs ficticios) | Correcta: el build asocia `DB` → D1, `UPLOADS` → R2 y las variables del modo equipo |
| `wrangler deploy --dry-run` (valida sin subir nada) | Correcto. Paquete: **645 KB comprimido** (límite: 3 MB en el plan gratuito, 10 MB en el de pago) |
| Modo equipo en ejecución local | `/` → `/admin`; las páginas públicas redirigen a `www.ipunto.digital`; las APIs públicas (`/api/leads`, `/api/checkout`, …) responden 404; `robots.txt` bloquea la indexación; todas las respuestas llevan `noindex` |
| Recorrido E2E completo en modo equipo | 57 pasos correctos, 0 fallidos |
| Migraciones con el motor D1 de Wrangler (base local) | Las 4 migraciones se aplican, con respaldo previo automático |
| Costo de CPU de iniciar sesión | PBKDF2 ≈ 7–9 ms de CPU por intento, medido en tu Mac, más el render de la página. **El plan gratuito de Workers permite 10 ms de CPU por solicitud**, así que el acceso podría fallar ahí (error 1102) |

**Conclusión:** es viable. Para operar con fiabilidad hace falta el plan **Workers Paid (US$5 al mes)**, por el límite de CPU. Puedes ensayar en el plan gratuito, sabiendo que el inicio de sesión podría fallar de forma intermitente.

## 2. Recursos que se necesitarán (aún no creados)

| Recurso | Nombre sugerido | Uso | Costo esperado |
|---|---|---|---|
| Worker | `punto-digital-equipo` | Panel, API privada, acceso y demos | Workers Paid: US$5/mes (incluye 10 M de solicitudes) |
| D1 | `punto-digital-equipo` | Prospectos, equipo, sesiones, auditoría, límites | Incluido en el plan (holgado para este volumen) |
| R2 | `punto-digital-equipo-archivos` | Imágenes ilustrativas generadas (opcional) | 10 GB gratis al mes. Activar R2 pide un método de pago |
| Dirección | `punto-digital-equipo.<tu-subdominio>.workers.dev` | Primera etapa, sin tocar el DNS | Gratis |

**Por qué `equipo.ipunto.digital` no puede ser el primer paso:** para conectar un subdominio propio a un Worker, el dominio `ipunto.digital` debe estar gestionado en Cloudflare. Hoy su DNS está en GoDaddy, y apunta a Vercel. Un `CNAME` desde GoDaddy hacia `workers.dev` no funciona; la configuración parcial de DNS requiere el plan Business. Por eso hay dos etapas (sección 6).

## 3. Lo que ya está preparado en el repositorio

- **Modo equipo** (`lib/deploy/team-mode.ts` + `worker/index.ts`): se activa al compilar con `CF_DEPLOYMENT_ROLE=team`.
- **`cloudflare/equipo.env.example`:** plantilla con los identificadores de tus recursos. Cópiala como `cloudflare/equipo.env`, que git ignora.
- **`npm run cf:build:team`:** valida la plantilla, compila y hace un *dry-run*. **No despliega.**
- **`npm run cf:d1 -- status | backup | apply --yes-apply-to-remote`:** migraciones y respaldos de la D1 remota. `apply` siempre respalda antes, en `backups/`, que git ignora.
- **Límites de solicitudes** en D1: tabla `request_rate_limits`, migración `0003`.
- **CI en GitHub** (`.github/workflows/ci.yml`): pruebas, typecheck, lint, builds, auditoría y E2E en cada PR.

## 4. Pasos para configurar tu cuenta (cuando decidas avanzar)

Ejecuta cada comando en la Terminal, dentro de la carpeta del proyecto. Lo marcado con **[autorización]** crea algo o cambia algo real: hazlo solo cuando lo decidas.

### 4.1 Cuenta y seguridad
1. Crea la cuenta en <https://dash.cloudflare.com/sign-up> con el correo de la empresa.
2. Activa la verificación en dos pasos: **My Profile → Authentication → Two-Factor Authentication**.
3. **[autorización]** Contrata **Workers Paid** en **Workers & Pages → Plans** (US$5/mes). Opcionalmente, crea antes una alerta de facturación en **Billing → Notifications**.
4. En **Workers & Pages**, anota tu subdominio `workers.dev` (por ejemplo `rodrigo-xyz.workers.dev`).

### 4.2 Conectar la terminal
```bash
npx wrangler login     # abre el navegador; autoriza el acceso
npx wrangler whoami    # debe mostrar tu correo y tu cuenta
```

### 4.3 Crear la base de datos y el almacenamiento [autorización]
```bash
npx wrangler d1 create punto-digital-equipo --location=wnam
npx wrangler r2 bucket create punto-digital-equipo-archivos   # requiere R2 activado en el panel
```
El primer comando muestra un `database_id` (formato `xxxxxxxx-xxxx-…`). Cópialo.

### 4.4 Completar la configuración local
```bash
cp cloudflare/equipo.env.example cloudflare/equipo.env
```
Abre `cloudflare/equipo.env` y completa `CF_D1_DATABASE_ID` con el ID del paso anterior, y `CF_TEAM_URL` con `https://punto-digital-equipo.<tu-subdominio>.workers.dev`.

### 4.5 Comprobar y preparar la base
```bash
npm run cf:d1 -- status                        # lista las 4 migraciones pendientes (solo lectura)
npm run cf:d1 -- apply --yes-apply-to-remote   # [autorización] respalda y aplica
npm run cf:build:team                          # compila y valida; no despliega
```

### 4.6 Desplegar con todo apagado [autorización]
```bash
npx wrangler deploy
```
Sin secretos configurados, el panel responde 404: es el estado seguro por defecto.

### 4.7 Secretos y primera cuenta [autorización]
Cada comando pide el valor de forma oculta. No los escribas en archivos ni en chats.
```bash
npx wrangler secret put PRIVATE_SURFACES_ENABLED   # escribe: true
npx wrangler secret put PROSPECT_OS_ENABLED        # escribe: false (por ahora)
npx wrangler secret put ADMIN_EMAIL                # tu correo
npx wrangler secret put AUTH_SECRET                # 32+ caracteres aleatorios
npx wrangler secret put AUTH_SETUP_TOKEN           # 32+ caracteres aleatorios
```
Para generar valores aleatorios: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

> Usa `secret put` también para los interruptores (`true`/`false`): las variables normales se reemplazarían en cada despliegue.

Después:
1. Abre `https://punto-digital-equipo.<tu-subdominio>.workers.dev/admin/acceso/activar`, activa tu cuenta (correo + `AUTH_SETUP_TOKEN` + app de autenticación) y comprueba que entras.
2. Elimina el token de configuración: `npx wrangler secret delete AUTH_SETUP_TOKEN`.
3. Desde una ventana privada, sin sesión, comprueba que `/admin` te manda al acceso y que `/api/prospect/prospects` responde 401.

### 4.8 Encender Prospect OS [autorización]
```bash
npx wrangler secret put PROSPECT_OS_ENABLED   # escribe: true
```
Los presupuestos de Google Places, Claude e imágenes siguen apagados hasta que los actives en Configuración.

## 5. Respaldo y recuperación
- **Antes de cada migración:** `npm run cf:d1 -- backup` (lo hace solo `apply`).
- **Punto en el tiempo:** `npx wrangler d1 time-travel info punto-digital-equipo` y, si hace falta, `npx wrangler d1 time-travel restore punto-digital-equipo --bookmark=<id>`. Restaurar pierde lo escrito después.
- Los archivos de `backups/` contienen datos personales: guárdalos cifrados y nunca los subas a git.

## 6. Etapa 2: `equipo.ipunto.digital` (requiere cambiar el DNS; no ahora)
1. En Cloudflare, **Add a site → `ipunto.digital`** (plan Free). Cloudflare importa los registros actuales.
2. Compara registro por registro con GoDaddy: `www`, el dominio raíz, **el correo (MX, SPF, DKIM)** y las verificaciones. Los registros de Vercel deben quedar en **DNS only** (nube gris).
3. **[autorización]** En GoDaddy, cambia los *nameservers* por los de Cloudflare. La propagación tarda de minutos a 48 h; durante ese tiempo, un error rompería el sitio o el correo.
4. **[autorización]** En el Worker: **Settings → Domains & Routes → Add → Custom domain → `equipo.ipunto.digital`**.
5. Cambia `CF_TEAM_URL` a `https://equipo.ipunto.digital`, ejecuta `npm run cf:build:team` y `npx wrangler deploy`.

## 7. Límites de solicitudes y su alcance

| Ruta | Límite | Dónde se cuenta |
|---|---|---|
| `/api/prospect/*` sin sesión | 300/min por IP | D1 (Cloudflare) |
| `/api/prospect/*` con sesión | 120/min por persona; 20/min en acciones de agentes | D1 |
| `/api/auth/*` | 20/min por IP, más bloqueo tras 5 fallos de acceso | D1 |
| `/propuesta/*` (demos) | 60/min por IP; 120/min por enlace | D1 |
| `/api/leads`, `/api/contact` | 5/min y 30/h por IP | **En Vercel: memoria por instancia** (parcial) |
| `/api/send-transfer-email` | 3 cada 10 min por IP | Igual |
| `/api/checkout` | 10/min por IP | Igual |

En Vercel no hay D1, así que los límites de los formularios públicos son una defensa parcial. Para que sean globales, crea en Vercel una regla **Firewall → Rate Limiting** para `/api/leads`, `/api/contact` y `/api/send-transfer-email` (por ejemplo, 10 solicitudes por minuto por IP), si tu plan lo incluye.
