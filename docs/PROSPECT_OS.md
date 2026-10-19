# Prospect OS — arquitectura y decisiones técnicas

Prospect OS es el módulo de adquisición asistida de clientes de Punto Digital. Vive dentro del mismo repositorio, el mismo Worker de Cloudflare, la misma base D1 y el mismo bucket R2 que el sitio comercial. Mercado inicial: Guadalajara y Zapopan.

Principio rector: **los agentes preparan, una persona aprueba y una persona contacta**. El sistema no tiene canal de envío.

## 1. Auditoría del repositorio (resumen)

| Área | Hallazgo | Consecuencia para Prospect OS |
|---|---|---|
| Runtime | Next.js 16 sobre Cloudflare Workers vía vinext (build principal). Build alternativo de Vercel con Webpack. | Todo el código corre en ambos builds; sin APIs exclusivas de Node. |
| Datos | D1 (`DB`) y R2 (`UPLOADS`) declarados en `.openai/hosting.json`. Sites empaqueta `drizzle/` como migraciones. | Una migración aditiva `0001_prospect_os.sql` (solo `CREATE TABLE`/`CREATE INDEX`). |
| Acceso a datos | Las rutas usan D1 directo vía `getD1Binding()` (sin `cloudflare:workers`, por compatibilidad con Vercel). | Mismo patrón; se añadieron `all()`/`batch()` al tipo y el binding R2 al Worker. |
| Identidad | Encabezados `oai-authenticated-user-*` inyectados por la plataforma Sites; `PRIVATE_SURFACES_ENABLED` y allowlist `ADMIN_EMAIL`. Sin roles. | Se reutiliza la identidad y se añade RBAC propio (`prospect_team`). |
| **Riesgo** | En Vercel nadie valida esos encabezados: un cliente podría falsificarlos. | Prospect OS se **desactiva siempre** si `VERCEL` está definido. El `/admin` existente comparte este riesgo si se habilita en Vercel. |
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

- **Autenticación y roles**: identidad de la plataforma más el rol de `prospect_team`. Escala: lectura < operador < revisor < administrador < propietario (`ADMIN_EMAIL`). Un administrador no puede crear administradores ni cambiar su propio rol. Sin acceso responde 404, para no revelar el módulo.
- **CSRF**: toda mutación exige JSON y mismo origen (`requireJsonRequest`).
- **Validación**: Zod estricto en cada endpoint; identificadores con formato fijo.
- **SSRF**: solo http(s) en puertos 80/443, sin credenciales; rechazo de IPs privadas o reservadas (v4/v6, también mapeadas y en formatos numéricos alternativos) y de hosts internos; DNS resuelto por DoH antes de cada salto; redirecciones manuales (máximo 3) revalidadas; límites de tiempo (8 s), tamaño (1.5 MB) y MIME.
- **Inyección de prompts**: el HTML de terceros nunca llega al modelo; solo campos extraídos y acotados, delimitados como `<datos_no_confiables>`, con instrucción de ignorar órdenes embebidas. La salida se valida con Zod.
- **Demos**: HTML sin scripts, todo escapado, colores validados, `noindex` (meta y `X-Robots-Tag`), `no-store`, `no-referrer`. Enlace con token de 256 bits del que solo se guarda el SHA-256; expira a los 14 días, rota al preparar cada envío y se anula al revocar o excluir.
- **Gasto**: se deniega por defecto. Ninguna llamada con costo ocurre sin presupuesto mensual habilitado; cada uso queda registrado (Claude con tokens reales, Places e imágenes con estimación), incluidas las respuestas fallidas que sí costaron.
- **Envíos duplicados**: borradores únicos por prospecto, campaña, canal y paso; el registro de envío es condicional y responde 409 la segunda vez.
- **Secretos**: solo en variables de entorno; el panel muestra si están configurados, nunca su valor. Los errores no registran cuerpos ni credenciales.
- **Places**: el `place_id` se conserva; el resto del contenido marca vencimiento a 30 días y existe una purga (Configuración → Mantenimiento). **Requiere revisión legal de los términos vigentes de Google Maps Platform.**

## 5. Operación

1. Aplicar la migración `0001_prospect_os.sql` (Sites la aplica al publicar; es aditiva).
2. Configurar secretos: `PROSPECT_OS_ENABLED=true` (con `PRIVATE_SURFACES_ENABLED=true` y `ADMIN_EMAIL`), y según el caso `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
3. En `/admin/prospectos/configuracion`: dar de alta al equipo, habilitar presupuestos y elegir proveedores.
4. Flujo diario: Prospección → ficha del prospecto (analizar, calificar, brief, demo) → aprobación del revisor → borrador → aprobación → «Preparar texto» → envío manual → «Registrar que lo envié» → registrar respuestas, reuniones y cierres.

## 6. Pendientes antes de operar con negocios reales

- Revisión jurídica: LFPDPPP, aviso de privacidad para prospectos, términos de Google Places y del proveedor de imágenes, y uso de correos comerciales publicados.
- Verificar en vivo los adaptadores de Google Places, Claude e imágenes. Solo se probaron con dobles de prueba; no se hicieron llamadas reales.
- Límite de solicitudes distribuido en `/propuesta/*` y en la API (hoy no existe).
- Escaneo antimalware si se aceptan cargas de archivos (no aplica todavía).
- Pruebas E2E de navegador del panel; la verificación actual es de servidor (HTTP) y unitaria.
- Respaldo y restauración probada de D1; monitoreo y alertas de errores y gasto.
- Si el volumen crece: Cloudflare Queues para descubrimiento e imágenes en lote, y paginación en `applySuppressions` (hoy recorre todos los prospectos activos).
