# RUNBOOK — Android Build (FACE Attendance Kiosk)

Requisitos para `npx expo run:android` (Expo SDK 58 / RN 0.88).

## Estado al auditar (2026-11-18)

| Componente | Estado |
|---|---|
| JDK | 1.8 — **insuficiente** (requiere 17+) |
| ANDROID_HOME / ANDROID_SDK_ROOT | vacío |
| adb | no encontrado |
| Node | 24.14.0 OK |

## Instalación

### 1. JDK 17+

- [ ] Instalar [Temurin 17](https://adoptium.net/) o Microsoft Build of OpenJDK 17 (x64)
- [ ] Verificar: `java -version` → 17.x

### 2. Android SDK

- [ ] Instalar Android Studio **o** cmdline-tools solos
- [ ] SDK Platform: Android 15 (API 35) o la que pida Expo
- [ ] SDK Build-Tools: 35.x
- [ ] Platform-Tools (adb)

Variables (user o sistema):

```text
ANDROID_HOME=C:\Users\<user>\AppData\Local\Android\Sdk
PATH += %ANDROID_HOME%\platform-tools
```

- [ ] Verificar: `adb version`

### 3. Verificación automatizada

```powershell
cd C:\Users\ZARAGOZA051\Desktop\nexus\app-movil
.\scripts\verify-android-env.ps1
```

Sale 0 si JDK≥17 y Android SDK presentes.

### 4. Build

```powershell
cd apps\attendance-kiosk
npx expo run:android
```

Primera vez: Gradle descarga dependencias (~5-15 min).

### 5. Smoke test

- [ ] App instala y abre en tablet/emulador
- [ ] Muestra `development` (o env activo) y estado device key
- [ ] Sin crash en boot (bootstrap SecureStore)

## Emulador (opcional)

- [ ] Device Manager en Android Studio → crear AVD (Pixel 6, API 35)
- [ ] `emulator -list-avds` → `emulator -avd <nombre>`

## Problemas comunes

| Síntoma | Fix |
|---|---|
| `JAVA_HOME is not set` | Apuntar a JDK 17 (`C:\Program Files\Eclipse Adoptium\jdk-17...`) |
| `SDK location not found` | Crear `local.properties` con `sdk.dir=` o export ANDROID_HOME |
| Expo pide dev client | Usar `npx expo run:android`, no Expo Go (SDK 58 Go no sirve para build custom) |
