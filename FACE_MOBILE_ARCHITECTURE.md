# FACE Mobile Platform
## Especificación técnica oficial y guía de implementación para OpenCode

**Estado:** Propuesta base aprobada para iniciar implementación  
**Producto:** FACE Nexus  
**Plataforma inicial:** Android  
**Lenguaje:** TypeScript  
**Framework:** React Native + Expo  
**Arquitectura:** Monorepo modular con aplicaciones independientes y paquetes compartidos  
**Backend:** FACE Nexus API existente (Node.js + Express)  

---

# PARTE I. ESPECIFICACIÓN TÉCNICA

## 1. Objetivo

Construir FACE Mobile Platform: una plataforma de aplicaciones móviles empresariales para FACE Nexus. Las aplicaciones tendrán instaladores, configuraciones, permisos y ciclos de liberación independientes, pero compartirán motores técnicos, contratos, componentes y servicios.

Aplicaciones previstas:

1. **FACE Attendance Kiosk:** asistencia desde tablet Android fija.
2. **FACE Workforce:** asistencia mediante cámara/lector físico y captura de producción de empleados.
3. **FACE Inventory:** recepción, identificación, etiquetado y movimientos de almacén.

La primera entrega debe priorizar la fundación compartida y el MVP de Attendance Kiosk. No se debe intentar construir las tres aplicaciones completas simultáneamente.

## 2. Decisiones tecnológicas

| Área | Decisión |
|---|---|
| Plataforma | Android primero |
| Lenguaje | TypeScript |
| Framework | React Native |
| Runtime y tooling | Expo |
| Monorepo | pnpm workspaces + Turborepo |
| Navegación | Expo Router |
| UI | Componentes propios + NativeWind, sujeto a compatibilidad del SDK |
| Estado local de UI | Zustand |
| Estado remoto | TanStack Query |
| Formularios | React Hook Form |
| Validación | Zod |
| Persistencia offline de asistencia | expo-sqlite |
| Credenciales | expo-secure-store |
| Cámara / QR / barcode | expo-camera |
| Conectividad | NetInfo |
| Pruebas unitarias | Jest |
| Pruebas E2E | Maestro |
| Build Android | EAS Build o Gradle local |
| Backend | API existente Node.js + Express |
| Base de datos central | PostgreSQL |
| Autenticación | JWT según contratos existentes de FACE Nexus |

Las versiones concretas deben seleccionarse al iniciar, verificando compatibilidad entre React Native, Expo SDK, Expo Router y módulos nativos. Fijar versiones exactas en lockfile. No actualizar dependencias mayores sin pruebas.

No incorporar dependencias solo por anticipación. Cada paquete debe tener una responsabilidad real y pruebas.

## 3. Principios arquitectónicos obligatorios

1. **Aplicaciones independientes:** cada app produce su propio APK/AAB y tiene su propio `applicationId`.
2. **Código compartido:** autenticación, tenant, API, sincronización, scanner, printer, UI y tipos viven en `packages/`.
3. **Backend como autoridad:** las reglas de negocio, permisos, licencias y validaciones definitivas permanecen en FACE Nexus API.
4. **Offline acotado:** inicialmente solo asistencia tendrá captura offline. Producción e inventario requieren conexión en esta primera etapa.
5. **Hardware desacoplado:** los módulos de negocio no importan SDKs ni implementaciones de hardware directamente.
6. **Idempotencia:** todo evento móvil sincronizable tiene UUID estable y el backend debe procesarlo idempotentemente.
7. **Multi-tenancy:** ninguna operación puede confiar en un `companyId` enviado libremente por el cliente.
8. **Seguridad por defecto:** secretos fuera del código, tokens en almacenamiento seguro, HTTPS y permisos mínimos.
9. **Trazabilidad:** registrar dispositivo, usuario/empleado, hora del evento, hora de recepción y resultado de sincronización.
10. **Compatibilidad incremental:** preparar interfaces para futuros adaptadores sin implementar características no aprobadas.

## 4. Aplicaciones e identificadores Android

| Aplicación | Nombre visible | `applicationId` propuesto |
|---|---|---|
| Kiosk | FACE Attendance | `com.facenexus.attendance` |
| Workforce | FACE Workforce | `com.facenexus.workforce` |
| Inventory | FACE Inventory | `com.facenexus.inventory` |

Confirmar disponibilidad de los identificadores antes de publicar. Cada app tendrá `app.config.ts`, assets, permisos Android, variables de entorno y pipeline de build propios.

No se debe incluir una app ficticia vacía en producción. Durante la fase inicial se pueden crear shells mínimos para validar el monorepo.

## 5. Estructura del monorepo

```text
face-mobile/
├── apps/
│   ├── attendance-kiosk/
│   │   ├── app/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   └── attendance/
│   │   │   │       ├── screens/
│   │   │   │       ├── components/
│   │   │   │       ├── hooks/
│   │   │   │       ├── services/
│   │   │   │       └── validators/
│   │   │   ├── config/
│   │   │   └── app/
│   │   ├── assets/
│   │   ├── app.config.ts
│   │   └── package.json
│   ├── workforce/
│   │   ├── app/
│   │   ├── src/modules/
│   │   │   ├── attendance/
│   │   │   ├── production/
│   │   │   └── incidents/
│   │   ├── assets/
│   │   ├── app.config.ts
│   │   └── package.json
│   └── inventory/
│       ├── app/
│       ├── src/modules/
│       │   ├── receiving/
│       │   ├── products/
│       │   ├── labels/
│       │   └── movements/
│       ├── assets/
│       ├── app.config.ts
│       └── package.json
├── packages/
│   ├── core/
│   ├── api-client/
│   ├── auth/
│   ├── tenant/
│   ├── permissions/
│   ├── device/
│   ├── database/
│   ├── offline-sync/
│   ├── scanner/
│   ├── printer/
│   ├── ui/
│   ├── design-system/
│   ├── validation/
│   └── shared-types/
├── tooling/
│   ├── eslint/
│   ├── typescript/
│   └── jest/
├── docs/
│   ├── FACE_MOBILE_ARCHITECTURE.md
│   ├── API_CONTRACTS.md
│   ├── ADR/
│   └── RUNBOOK_ANDROID.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── README.md
```

La estructura anterior es una guía. Ajustarla si el código real o las convenciones del repositorio justifican una mejora, documentando la decisión. Evitar carpetas vacías sin propósito.

### Reglas de dependencias

- `apps/*` pueden importar `packages/*`.
- `packages/core` no puede importar código de una aplicación.
- `packages/scanner` no puede importar módulos de asistencia o producción.
- `packages/printer` no puede importar módulos de inventario.
- Los módulos de negocio consumen interfaces, no implementaciones nativas.
- Evitar dependencias circulares.
- Los tipos compartidos no deben contener lógica de negocio ni acceso a infraestructura.
- Cada paquete expone una API pública mediante `src/index.ts`.

## 6. Contratos de motores compartidos

Los contratos siguientes son interfaces iniciales. Se deben convertir en tipos TypeScript y pruebas de contrato. No asumir que las implementaciones nativas existen por el hecho de declarar una interfaz.

### 6.1 Scanner Engine

Fuentes admitidas:

- Cámara Android mediante `expo-camera`.
- Escáner USB/Bluetooth que se presenta como teclado HID.
- Adaptador nativo Kotlin para lectores Bluetooth SPP o SDK específicos, solo cuando un dispositivo real lo requiera.

```ts
export type ScannerSource = 'camera' | 'hid' | 'native';

export interface ScanResult {
  value: string;
  format: string;
  source: ScannerSource;
  scannedAt: string; // ISO 8601
}

export interface ScannerConfig {
  acceptedFormats: string[];
  duplicateWindowMs: number;
}

export interface ScannerService {
  start(config: ScannerConfig): Promise<void>;
  stop(): Promise<void>;
  subscribe(
    callback: (result: ScanResult) => void
  ): () => void;
}
```

Requisitos:
- Evitar lecturas duplicadas con ventana configurable.
- Validar formatos permitidos por flujo.
- Controlar permisos de cámara.
- Liberar cámara al salir de la pantalla.
- HID debe soportar sufijo configurable (Enter/Tab) y buffer de entrada.
- No interpretar cualquier texto del teclado como escaneo sin una estrategia de activación/configuración.
- La lectura nunca confirma por sí sola una operación empresarial; primero se valida el identificador contra el caso de uso.

### 6.2 Printer Engine

Primera etapa: impresoras de red Wi-Fi/LAN, configuradas por IP, puerto, fabricante, modelo y protocolo.

Protocolos posibles según modelo:
- ZPL.
- ESC/POS.
- CPCL.
- SDK propietario del fabricante.

No asumir que todas las impresoras aceptan impresión TCP directa ni que todas usan el mismo puerto.

```ts
export interface PrinterConfig {
  printerId: string;
  host: string;
  port: number;
  manufacturer?: string;
  model?: string;
  protocol: 'ZPL' | 'ESCPOS' | 'CPCL' | 'VENDOR_SDK';
}

export interface PrintJob {
  jobId: string;
  payload: string | Uint8Array;
  copies: number;
}

export type PrintStatus =
  | 'QUEUED'
  | 'SENT'
  | 'CONFIRMED'
  | 'FAILED'
  | 'UNKNOWN';

export interface PrintResult {
  jobId: string;
  status: PrintStatus;
  errorCode?: string;
  message?: string;
}

export interface PrinterService {
  testConnection(config: PrinterConfig): Promise<boolean>;
  print(
    config: PrinterConfig,
    job: PrintJob
  ): Promise<PrintResult>;
}
```

Requisitos:
- Separar generador de etiqueta, protocolo y transporte.
- No almacenar contraseñas de impresoras en texto plano.
- Validar IP/puerto y restringir destinos de red según política.
- Manejar timeout, desconexión y reintento controlado.
- No afirmar que una etiqueta se imprimió si solo se enviaron bytes. Usar `SENT` o `UNKNOWN` cuando el dispositivo no permita confirmar físicamente la impresión.
- No implementar Bluetooth printer en el MVP; conservarlo como futuro adaptador.

### 6.3 Offline / Sync Engine

Offline inicial: únicamente eventos de asistencia.

```ts
export type SyncStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'REJECTED';

export interface AttendanceEvent {
  eventId: string; // UUID generado una sola vez
  employeeId: number;
  deviceId: string;
  eventType: 'ENTRY' | 'EXIT';
  occurredAt: string; // ISO 8601 con offset
  latitude?: number;
  longitude?: number;
  syncStatus: SyncStatus;
  attemptCount: number;
  lastError?: string;
}

export interface SyncResult {
  eventId: string;
  status: 'SYNCED' | 'DUPLICATE' | 'REJECTED';
  serverRecordId?: number;
  errorCode?: string;
  message?: string;
}

export interface OfflineSyncService {
  enqueueAttendance(
    event: AttendanceEvent
  ): Promise<void>;
  syncPending(): Promise<SyncResult[]>;
  getPendingCount(): Promise<number>;
}
```

Reglas obligatorias:
1. Persistir el evento en SQLite dentro de una transacción antes de mostrarlo como guardado.
2. Generar `eventId` una sola vez; nunca generar un UUID nuevo en cada reintento.
3. Mantener el evento hasta recibir respuesta individual del servidor.
4. Enviar lotes limitados y procesar resultados por evento.
5. Reintentar errores transitorios con backoff exponencial y jitter.
6. No reintentar indefinidamente errores funcionales `REJECTED`.
7. Conservar registros rechazados para diagnóstico y resolución autorizada.
8. Recuperar procesos pendientes al iniciar la app.
9. No depender de que la app permanezca abierta para conservar datos.
10. No asumir que NetInfo garantiza acceso real al backend; manejar timeout y fallos HTTP.
11. Evitar que dos procesos ejecuten simultáneamente el mismo evento.
12. No borrar ni sobrescribir datos locales sin confirmación y política de retención.

Tablas SQLite iniciales:

| Tabla | Uso |
|---|---|
| `employees_cache` | Datos mínimos de empleados autorizados |
| `attendance_events` | Eventos locales |
| `sync_queue` | Cola durable de sincronización |
| `sync_logs` | Historial técnico de sincronización |
| `device_config` | Configuración local no secreta |

Usar migraciones versionadas. Definir índices por `eventId`, estado y fecha. Minimizar datos personales en caché. Evaluar SQLCipher y política de retención antes de almacenar información sensible.

### 6.4 Device Management

```ts
export type DeviceType =
  | 'KIOSK'
  | 'WORKFORCE'
  | 'INVENTORY';

export interface DeviceIdentity {
  deviceId: string;
  deviceType: DeviceType;
  appVersion: string;
  platform: 'ANDROID';
  registeredAt?: string;
  status: 'ACTIVE' | 'BLOCKED';
}
```

Requisitos:
- UUID de instalación persistido de forma segura.
- Registro y revocación desde backend.
- Asociación de dispositivo a empresa/establecimiento.
- Credencial de dispositivo revocable; no usar un ID de hardware como secreto.
- Heartbeat con versión y estado.
- El servidor valida estado, tenant, licencia y módulos.
- Un dispositivo bloqueado no puede registrar operaciones.
- No incluir tokens ni secretos en logs.

## 7. Autenticación, seguridad y multi-tenancy

Flujo lógico:

```text
Autenticación de usuario/dispositivo
              ↓
Validar token
              ↓
Validar estado del dispositivo
              ↓
Cargar Tenant Context desde servidor
              ↓
Validar empresa / establecimiento
              ↓
Validar licencia y módulo
              ↓
Validar permisos
              ↓
Ejecutar caso de uso
```

Reglas:
- HTTPS obligatorio fuera de desarrollo local.
- Access token de duración limitada.
- Refresh token protegido con `expo-secure-store`.
- No guardar contraseñas.
- No guardar tokens en AsyncStorage ni SQLite.
- No incluir secretos en variables `EXPO_PUBLIC_*`.
- No confiar en `companyId`, permisos, licencias o roles enviados por el cliente.
- El backend obtiene el contexto autorizado a partir de credenciales validadas.
- Aplicar mínimo privilegio y revocación de dispositivos.
- No registrar tokens, datos personales completos ni payloads sensibles.
- Definir política de expiración y revocación de sesión.
- Proteger datos locales; considerar cifrado de SQLite según clasificación de datos.
- El modo kiosco debe implementarse mediante Android Lock Task Mode y aprovisionamiento como dispositivo dedicado/MDM. El screen pinning común no equivale a modo kiosco administrado.
- La autenticación de dispositivo no sustituye la autorización del usuario ni la validación del empleado.

En modo kiosco, la app mantiene una sesión de dispositivo controlada; el empleado se identifica mediante credencial. El backend valida la credencial y las reglas vigentes.

## 8. Sincronización de asistencia

### Flujo

```text
Escaneo de credencial
        ↓
Resolver empleado desde caché autorizada
        ↓
Validación local mínima
        ↓
Generar UUID del evento
        ↓
Guardar evento y cola en SQLite
        ↓
Mostrar "Guardado en dispositivo"
        ↓
Conectividad disponible
        ↓
POST batch de eventos pendientes
        ↓
Backend valida cada evento
        ↓
Respuesta individual por eventId
        ↓
Marcar SYNCED / REJECTED
```

Estados que verá el usuario:
- Guardado en dispositivo.
- Pendiente de sincronización.
- Sincronizado.
- Requiere revisión.

No mostrar “Asistencia confirmada por servidor” mientras el evento esté offline.

### Reglas de hora

- Guardar `occurredAt` como fecha ISO 8601 con offset de zona.
- Guardar la hora de recepción del servidor en backend.
- Registrar zona horaria configurada.
- No confiar ciegamente en el reloj Android.
- Si existe sincronización horaria confiable, registrar el estado/offset como metadato.
- No alterar retroactivamente la hora original al sincronizar.

### Idempotencia en backend

- `eventId` debe tener restricción única en el ámbito adecuado (global o tenant, según modelo).
- El endpoint debe devolver el resultado del evento previamente procesado cuando se repita la misma clave.
- Una misma clave con payload incompatible debe producir conflicto auditable.
- La validación y persistencia deben ejecutarse en transacción.
- La respuesta del lote debe incluir resultado para cada `eventId`.

## 9. Contratos de API propuestos

Estos endpoints son una propuesta de contrato, no una afirmación de que ya existan. Antes de implementarlos, inspeccionar las rutas reales del backend y reutilizar las existentes cuando cubran el caso.

| Método | Ruta propuesta | Propósito |
|---|---|---|
| POST | `/api/v1/mobile/devices/register` | Registrar dispositivo |
| POST | `/api/v1/mobile/devices/heartbeat` | Estado del dispositivo |
| GET | `/api/v1/mobile/bootstrap` | Configuración inicial autorizada |
| GET | `/api/v1/mobile/employees` | Descargar empleados mínimos autorizados |
| POST | `/api/v1/asistencia/events` | Registrar evento individual |
| POST | `/api/v1/asistencia/sync` | Sincronizar lote de eventos |
| POST | `/api/v1/produccion/events` | Captura de producción online |
| GET | `/api/v1/almacen/products` | Consulta de productos |
| POST | `/api/v1/almacen/recepciones` | Registrar recepción |
| POST | `/api/v1/almacen/etiquetas` | Crear datos/solicitud de etiqueta |

### Ejemplo de sincronización

Request:

```json
{
  "events": [
    {
      "eventId": "UUID",
      "employeeId": 120,
      "deviceId": "UUID-DEVICE",
      "eventType": "ENTRY",
      "occurredAt": "2026-11-18T07:00:00-06:00"
    }
  ]
}
```

Response:

```json
{
  "results": [
    {
      "eventId": "UUID",
      "status": "SYNCED",
      "serverRecordId": 456
    }
  ]
}
```

Los contratos definitivos deben documentar:
- Esquema Zod request/response.
- Códigos HTTP.
- Códigos funcionales de rechazo.
- Autenticación requerida.
- Permisos y módulo requerido.
- Contexto tenant.
- Idempotencia.
- Paginación y límites de lote.
- Compatibilidad/versionado.

## 10. Impresión de etiquetas de red

Flujo futuro de Inventory:

1. Capturar producto, proveedor, lote y datos requeridos.
2. Enviar al backend para validar y registrar recepción.
3. Recibir identificador único del producto/lote.
4. Solicitar datos de etiqueta al backend o generarlos desde contrato autorizado.
5. Renderizar etiqueta con plantilla versionada.
6. Enviar al adaptador de impresora configurada.
7. Registrar job y resultado de impresión.

La impresión no debe crear ni confirmar por sí misma una recepción. La operación de negocio se confirma en backend; la impresión es una acción posterior trazable.

No habilitar impresión offline en primera versión.

## 11. Configuración y entornos

Entornos:
- `development`
- `staging`
- `production`

Configuración:
- URL API por entorno.
- Identificador de aplicación por app.
- Feature flags entregados y validados por backend.
- No incluir secretos en el bundle.
- No usar producción desde builds de desarrollo.
- Configurar Android permissions solo cuando la app las necesite.
- Documentar permisos de cámara, red y dispositivos cercanos si algún adaptador Bluetooth futuro los requiere.

## 12. Observabilidad y diagnóstico

Registrar:
- Versión de app.
- ID de instalación/dispositivo.
- Estado de conectividad.
- Conteo de eventos pendientes.
- Duración y resultado de sincronización.
- Errores de API y SQLite.
- Estado de impresora y job, cuando aplique.

No registrar:
- JWT/refresh tokens.
- Contraseñas.
- QR completos si contienen datos personales.
- Datos sensibles innecesarios.

Preparar integración con el sistema de monitoreo de FACE Nexus (por ejemplo, Sentry si se aprueba), sin bloquear el MVP por esa integración.

## 13. Estrategia de pruebas

### Unitarias
- Validadores.
- Reglas de transformación.
- Debounce del scanner.
- Estados de sincronización.
- Backoff/reintentos.
- Idempotencia del cliente.
- Manejo de errores.

### Integración
- SQLite y migraciones.
- API Client.
- Autenticación/renovación.
- Descarga de empleados.
- Sincronización por lotes.
- Revocación de dispositivo.

### E2E / hardware
- Cámara QR en tablet real.
- Lector HID real.
- Reinicio con eventos pendientes.
- Pérdida y recuperación de conectividad.
- Modo kiosco administrado.
- Impresora de red real en fase Inventory.

No considerar una prueba simulada como sustituto de una prueba de hardware.

## 14. Criterios de aceptación del MVP Attendance Kiosk

El MVP no se considera terminado hasta cumplir:

1. La app Android se instala y abre en una tablet objetivo.
2. El dispositivo se registra y queda asociado a la empresa autorizada.
3. Descarga empleados mínimos autorizados.
4. Escanea QR y resuelve el empleado.
5. Valida credencial y reglas locales permitidas.
6. Registra entrada/salida sin internet.
7. Persiste evento en SQLite antes de mostrar guardado.
8. Sobrevive al cierre forzado y reinicio del dispositivo.
9. Sincroniza al recuperar conectividad.
10. Reintentos no crean duplicados.
11. Backend devuelve resultado individual por evento.
12. Eventos rechazados quedan visibles para revisión autorizada.
13. Dispositivo bloqueado no puede registrar ni sincronizar operaciones nuevas.
14. La app diferencia guardado local de confirmación del servidor.
15. No se exponen tokens ni datos sensibles en logs.
16. El modo kiosco se prueba en dispositivo Android administrado.
17. Existe documentación de instalación, configuración y soporte.

### Prueba de resistencia mínima

- Registrar 100 eventos de prueba sin conexión.
- Cerrar forzadamente y reiniciar la tablet.
- Confirmar que los 100 eventos siguen en SQLite.
- Recuperar conectividad.
- Sincronizar.
- Repetir el mismo lote.
- Confirmar que el backend conserva exactamente 100 eventos únicos y que el cliente reconoce los ya procesados.

## 15. Fuera del alcance del MVP

No implementar todavía:
- iOS.
- Producción offline.
- Inventario offline.
- Impresión Bluetooth.
- Reconocimiento facial.
- NFC.
- Geocercas.
- Sincronización bidireccional genérica.
- Microservicios nuevos.
- Backend móvil separado.
- Rediseño de módulos existentes del ERP.

Dejar interfaces y decisiones documentadas solo cuando aporten valor y no generen complejidad prematura.

## 16. Plan de implementación

Las estimaciones son orientativas y dependen de auditoría del backend, dispositivos de prueba y disponibilidad del hardware.

| Fase | Trabajo | Entregable |
|---|---|---|
| 0 | Auditoría del repositorio y backend | Informe de compatibilidad y contratos existentes |
| 1 | Monorepo, Expo, TypeScript, CI, shells | Tres apps compilables |
| 2 | API client, auth, tenant, device | Conexión segura con backend |
| 3 | Scanner, SQLite, sync engine | Motores probados |
| 4 | Attendance Kiosk | MVP offline de asistencia |
| 5 | Workforce | Asistencia y producción online |
| 6 | Inventory y Printer Engine | Recepción e impresión por red |
| 7 | Hardening y despliegue | Release empresarial |

Orden obligatorio: Fase 0 antes de modificar el backend o generar infraestructura duplicada.

## 17. Registro de decisiones arquitectónicas

| ID | Decisión | Estado |
|---|---|---|
| ADR-001 | Android primero | Aprobada |
| ADR-002 | React Native + Expo + TypeScript | Aprobada |
| ADR-003 | Monorepo pnpm + Turborepo | Aprobada |
| ADR-004 | Aplicaciones e instaladores independientes | Aprobada |
| ADR-005 | Cámara + lectores HID; Kotlin solo si se requiere | Aprobada |
| ADR-006 | Impresión inicial por red | Aprobada |
| ADR-007 | Offline inicial solo para asistencia | Aprobada |
| ADR-008 | FACE Nexus API como backend único | Aprobada |
| ADR-009 | SQLite para persistencia offline | Aprobada |
| ADR-010 | Modo kiosco Android administrado | Aprobada |

---

# PARTE II. PROMPT MAESTRO PARA OPENCODE

Copiar el siguiente prompt en OpenCode desde la raíz del repositorio donde se implementará FACE Mobile.

## Prompt de inicio

```text
Actúa como arquitecto de software senior y desarrollador especializado en React Native, Expo, TypeScript, Android, Node.js y sistemas empresariales multi-tenant.

PROYECTO:
FACE Mobile Platform — ecosistema móvil de FACE Nexus.

DOCUMENTO DE AUTORIDAD:
Lee completo el archivo FACE_MOBILE_ARCHITECTURE.md antes de realizar cambios.
Ese documento define las decisiones arquitectónicas, alcance, contratos y criterios de aceptación.

OBJETIVO INICIAL:
No desarrolles las tres aplicaciones funcionales todavía.
Primero audita el entorno, valida las decisiones contra el repositorio real y construye una base técnica compilable, verificable y preparada para implementar el MVP de FACE Attendance Kiosk.

REGLAS OBLIGATORIAS:

1. INSPECCIÓN ANTES DE MODIFICAR
- Inspecciona el repositorio, package.json, lockfiles, estructura y convenciones existentes.
- Determina si el repositorio está vacío, contiene un proyecto previo o forma parte de un monorepo.
- Localiza el backend FACE Nexus si está disponible en el workspace.
- Inspecciona las rutas, middleware, autenticación, tenancy, permisos, licencias y módulos existentes.
- No inventes endpoints ni afirmes que existen sin verificarlos.
- No sobrescribas archivos ni configuraciones existentes sin comprender su función.
- Identifica versiones de Node, pnpm, Expo, React Native y Android tooling disponibles.

2. RESPETA EL STACK
- React Native + Expo + TypeScript.
- pnpm workspaces + Turborepo, salvo incompatibilidad demostrada.
- Expo Router.
- Zustand para estado local.
- TanStack Query para estado remoto.
- Zod para validaciones.
- expo-sqlite para persistencia offline de asistencia.
- expo-secure-store para credenciales.
- expo-camera para cámara y QR/barcode.
- NetInfo para conectividad.
- Jest y Maestro para pruebas.
- No incorpores dependencias innecesarias.
- Verifica compatibilidad de versiones con el Expo SDK elegido y conserva lockfile.

3. RESPETA LA ARQUITECTURA
- Tres aplicaciones independientes: attendance-kiosk, workforce e inventory.
- Paquetes compartidos bajo packages/.
- Los módulos de negocio no importan implementaciones concretas de hardware.
- Scanner y Printer se consumen mediante interfaces.
- El backend FACE Nexus es la autoridad de permisos y reglas empresariales.
- No crees un backend móvil paralelo.
- No dupliques módulos o endpoints que ya existan.

4. SEGURIDAD
- Nunca guardes tokens en AsyncStorage ni en SQLite.
- Usa SecureStore para credenciales.
- No expongas secretos en EXPO_PUBLIC_*.
- No confíes en companyId, roles o permisos enviados por el cliente.
- Respeta tenant, licencias, módulos y permisos del backend.
- No registres tokens ni información personal sensible.
- No desactives TLS ni validaciones para hacer funcionar una prueba.
- No implementes autenticación ficticia en builds de producción.

5. OFFLINE
- En esta etapa, offline solo para asistencia.
- Cada evento tiene UUID estable.
- Guardar evento local antes de confirmar que quedó guardado.
- Sincronizar por lotes con resultado individual.
- Reintentos idempotentes.
- Persistir eventos después de cerrar o reiniciar la aplicación.
- Distinguir PENDING, SYNCED y REJECTED.
- No afirmar que un evento offline ya fue confirmado por el servidor.
- No implementar offline para producción o inventario todavía.

6. HARDWARE
- Cámara mediante expo-camera.
- Lectores HID tratados como entrada de teclado, con estrategia para distinguirlos de escritura manual.
- No agregar módulos Kotlin hasta comprobar que un dispositivo real requiere Bluetooth SPP o SDK nativo.
- Impresoras futuras por red Wi-Fi/LAN.
- No implementar impresión Bluetooth en esta etapa.
- No simular una conexión real a hardware.

7. CALIDAD
- TypeScript estricto.
- Código modular, tipado y testeable.
- Manejo explícito de errores.
- Sin any injustificados.
- Sin funciones vacías o implementaciones falsas.
- Sin mocks en código productivo.
- Pruebas para lógica crítica.
- No ocultes errores con casts, eslint-disable o ts-ignore sin justificación documentada.
- No declares una tarea terminada sin ejecutar las verificaciones disponibles.

PLAN DE TRABAJO:

FASE 0 — AUDITORÍA
Entrega primero un informe que contenga:
A. Estado del repositorio.
B. Stack y versiones detectadas.
C. Estructura actual.
D. Backend localizado y endpoints reales relevantes.
E. Middleware de autenticación, tenant, licencia y permisos.
F. Capacidades existentes que se pueden reutilizar.
G. Riesgos e incompatibilidades.
H. Diferencias entre el documento de arquitectura y el estado real.
I. Plan de cambios ordenado.

No modifiques código durante esta primera auditoría.
Si el backend no está disponible, decláralo y no inventes sus contratos.

FASE 1 — FUNDACIÓN
Después de presentar la auditoría, implementa la fundación del monorepo:
- Configuración pnpm workspaces.
- Turborepo.
- TypeScript base estricto.
- ESLint y formato coherentes.
- Configuración de pruebas.
- Shell mínimo de cada aplicación.
- Configuración Expo individual.
- Identificadores Android independientes.
- Paquetes compartidos con exports públicos.
- Variables de entorno por aplicación y entorno.
- Scripts documentados para desarrollo, lint, typecheck, test y build.

No crees carpetas vacías sin propósito.
No agregues módulos funcionales incompletos.

FASE 2 — INTEGRACIÓN BASE
Implementa:
- API Client tipado.
- Manejo centralizado de errores HTTP.
- SecureStore adapter.
- Auth contracts según backend real.
- Tenant context obtenido desde backend.
- Device identity y registro si el backend lo soporta.
- TanStack Query provider.
- Configuración de entornos.

Si el backend carece de un endpoint requerido, documenta el contrato propuesto y solicita aprobación antes de modificarlo.

FASE 3 — MOTORES PARA EL MVP
Implementa y prueba:
- Scanner abstraído.
- Adaptador de cámara.
- Adaptador HID solo si el entorno permite una integración correcta.
- SQLite y migraciones.
- Attendance repository.
- Sync queue durable.
- Sync engine con idempotencia y resultados por evento.
- Manejo de conectividad.
- Estados visibles de sincronización.

FASE 4 — ATTENDANCE KIOSK
Implementa el flujo de asistencia definido en FACE_MOBILE_ARCHITECTURE.md:
- Bootstrap.
- Descarga de empleados autorizados.
- Escaneo.
- Identificación.
- Registro local.
- Sincronización.
- Historial/estado operativo.
- Modo kiosco solo después de validar el método de aprovisionamiento Android disponible.

CRITERIOS DE ACEPTACIÓN:
Usa los criterios del documento.
No marques el MVP como terminado si no se prueba persistencia tras reinicio, sincronización e idempotencia.
Las pruebas de hardware deben quedar identificadas como pendientes cuando no exista hardware real.

FORMA DE TRABAJO:
- Trabaja en pasos pequeños y verificables.
- Antes de cada grupo de cambios, explica brevemente el objetivo y archivos afectados.
- Mantén un TODO técnico actualizado.
- Registra decisiones nuevas en docs/ADR/.
- Si una decisión cambia el documento oficial, propone el cambio antes de aplicarlo.
- No hagas refactors ajenos al alcance.
- No borres archivos existentes sin justificación.
- No hagas commits salvo que se solicite.
- Al terminar cada fase, entrega resumen, archivos modificados, comandos ejecutados, resultados de pruebas y pendientes.

PRIMERA ACCIÓN:
Ejecuta exclusivamente FASE 0 — AUDITORÍA.
No escribas código ni instales dependencias hasta entregar el informe y recibir aprobación.
```

## 18. Cómo iniciar correctamente en OpenCode

1. Coloca `FACE_MOBILE_ARCHITECTURE.md` en la raíz del repositorio móvil.
2. Abre OpenCode en esa carpeta.
3. Activa las skills de arquitectura y desarrollo que tengas instaladas y sean compatibles.
4. Pega el prompt maestro.
5. Revisa la auditoría antes de aprobar la implementación.
6. Autoriza primero la fundación; después, los motores y el MVP.

**Importante:** si el repositorio móvil todavía no existe, crea una carpeta de trabajo independiente. No mezcles el monorepo móvil con el backend existente sin una decisión explícita de estructura.

---

# PARTE III. DEFINICIÓN DE TERMINADO

La primera entrega de OpenCode debe producir:

- [ ] Auditoría del entorno y backend.
- [ ] Monorepo configurado.
- [ ] Tres aplicaciones Android compilables.
- [ ] Paquetes compartidos con límites claros.
- [ ] API Client y contratos documentados.
- [ ] Configuración de TypeScript, lint y pruebas.
- [ ] README con instrucciones reproducibles.
- [ ] Registro de decisiones arquitectónicas.
- [ ] Plan técnico del MVP Attendance Kiosk.
- [ ] Ninguna integración ficticia ni endpoint inventado.

**Criterio de control:** primero arquitectura comprobada; después código. No permitir que el agente genere toda la plataforma de una sola vez sin validar cada fase.
