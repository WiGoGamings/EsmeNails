# EsmeNails

Aplicacion de gestion para salon (agenda, clientes, promociones, puntos, contacto y panel admin).

## Titular legal

- Nombre: Maria Esmeradla Guillen
- Pais: Venezuela

## Requisitos

- Node.js 20+
- npm 10+

## Desarrollo local

```bash
npm install
npm --prefix server install
npm run dev
```

Cliente: `http://localhost:5173`
API: `http://localhost:4000/api`

## Scripts utiles

- `npm run dev`: cliente + servidor en desarrollo
- `npm run lint`: validacion de codigo
- `npm run build`: build web (Vite)
- `npm run desktop:dev`: ejecuta cliente + servidor + Electron en local
- `npm run desktop:build`: genera instalador Windows (`nsis`) y portable (ajustado para Electron sin pantalla blanca)
- `npm run desktop:build:portable`: genera solo version portable
- `npm run desktop:build:installer`: genera solo instalador
- `npm run android:sync`: compila web y sincroniza cambios al proyecto Android
- `npm run android:open`: abre el proyecto Android en Android Studio
- `npm run android:build`: alias de sincronizacion para preparar build Android

Los ejecutables de escritorio se generan en `release/`.

## Generar app Android (APK/AAB)

1. Instala dependencias y sincroniza:

```bash
npm install
npm run android:sync
```

2. Abre Android Studio:

```bash
npm run android:open
```

3. Dentro de Android Studio:
- Para prueba local: **Build > Build APK(s)**
- Para Play Store: **Build > Generate Signed Bundle / APK** (elige **Android App Bundle**) 

Salida esperada:
- APK de pruebas en la carpeta `android/app/build/outputs/apk/`
- AAB firmado para publicacion en Play Console

## Publicar en GitHub (gratis)

1. Crear repositorio en GitHub (por ejemplo `EsmeNails`).
2. Inicializar y subir:

```bash
git init
git add .
git commit -m "Initial public release"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/EsmeNails.git
git push -u origin main
```

## Publicar descarga para PC en GitHub Releases

1. Generar build de escritorio:

```bash
npm install
npm --prefix server install
npm run desktop:build
```

2. Abrir GitHub > tu repo > **Releases** > **Draft a new release**.
3. Crear una etiqueta (ej. `v1.0.0`).
4. Adjuntar los archivos `.exe` desde `release/`.
5. Publicar release.

Con esto, cualquier persona podra descargar tu app para PC sin Play Console.

## Abrirla desde GitHub tipo app

### Opcion 1: Descargar app de PC (.exe)

1. Entra al repo: `https://github.com/WiGoGamings/EsmeNails`.
2. Abre la pestana **Releases**.
3. Descarga el archivo `.exe` mas reciente.
4. Ejecutalo en Windows.

### Opcion 2: Abrir version web (GitHub Pages)

1. Entra al repo en GitHub.
2. Ve a **Settings > Pages**.
3. En **Build and deployment**, selecciona **GitHub Actions**.
4. Haz push a `main` y el workflow `Deploy Web (GitHub Pages)` publicara la app.

Notas:
- El workflow web usa `VITE_API_URL` desde **Settings > Secrets and variables > Actions > Variables**.
- Si no defines `VITE_API_URL`, la app web compilara igual, pero necesitara que el backend este disponible para iniciar sesion y usar funciones de datos.

### Opcion 3: Publicar frontend en Netlify (gratis + HTTPS)

1. Entra a Netlify y elige **Add new site > Import an existing project**.
2. Conecta tu repo `WiGoGamings/EsmeNails`.
3. Build settings:
	- Build command: `npm run build`
	- Publish directory: `dist`
4. En **Site configuration > Environment variables**, agrega:
	- `VITE_API_URL=https://esmenails-api.onrender.com/api`
5. Haz deploy.

Notas:
- Este repo ya incluye `netlify.toml` con fallback SPA (`/* -> /index.html`) para que funcionen las rutas del frontend.
- La URL gratis quedara tipo `https://tu-sitio.netlify.app` con HTTPS automatico.

## Automatizacion incluida (GitHub Actions)

Este repo ya incluye:

- `.github/workflows/desktop-release.yml`
	- Al subir un tag `v*` (ejemplo `v1.0.1`), compila Windows y Android, y adjunta `.exe` + `.apk` automaticamente al Release.
- `.github/workflows/pages.yml`
	- Al hacer push a `main`, compila y publica la web en GitHub Pages.

Para disparar release automatica de escritorio:

```bash
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

Nota importante:
- El workflow de release toma la version directamente del tag (`v1.0.1` -> `1.0.1`) antes de compilar Electron.
- Si quieres un `.exe` realmente nuevo, crea siempre un tag nuevo (`v1.0.2`, `v1.0.3`, etc.).

Seguridad de descarga:
- En cada release se adjuntan hashes SHA-256 (`*.sha256` y `SHA256SUMS.txt`) para validar integridad.
- Si configuras firma de codigo en GitHub Secrets (`CSC_LINK` y `CSC_KEY_PASSWORD`), Electron Builder firma automaticamente el ejecutable.

Instalador vs portable:
- `EsmeNails Setup x.y.z.exe` instala la app en Windows (asistente de instalacion).
- `EsmeNails.x.y.z.exe` (portable) solo se ejecuta, no instala.

### Si descargaste un `.exe` y se abre una version anterior

1. Verifica que descargaste el asset del release mas reciente (no uno viejo).
2. Cierra la app completamente antes de abrir el nuevo `.exe`.
3. Si usas acceso directo anclado, borralo y crea uno nuevo desde el `.exe` descargado.
4. Si instalaste con instalador, desinstala primero la version anterior y luego instala la nueva.
5. Compara fecha/tamano del archivo para confirmar que es distinto al anterior.

### Verificar integridad del .exe en Windows

1. Descarga el `.exe` y su archivo `.sha256` del mismo release.
2. En PowerShell, ejecuta:

```powershell
Get-FileHash .\EsmeNails.exe -Algorithm SHA256
```

3. Compara el valor `Hash` con el contenido del archivo `.sha256`.
4. Si ambos coinciden, el archivo no fue alterado.

## Variables de entorno

Puedes copiar `.env.example` y ajustar valores en `server/.env` segun necesites (correo SMTP, credenciales admin, etc.).

Importante en produccion:

- `JWT_SECRET`, `ENCRYPTION_SECRET` y `ADMIN_PASSWORD` deben ser seguros y no usar valores por defecto.
- Si falta alguno en produccion, el backend ahora detiene el arranque para evitar despliegues inseguros.

## Activar conexion real en GitHub Pages

Si en la web publicada aparece `Cita guardada en modo local (sin conexion al servidor)`, falta una API publica.

1. Despliega el backend con Render usando `render.yaml` (raiz del repo).
2. Copia la URL publica de tu backend (ejemplo: `https://esmenails-api.onrender.com`).
3. Ejecuta el script para registrar `VITE_API_URL` en GitHub Actions:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\set-gh-actions-var.ps1 -GitHubToken "TU_TOKEN_GITHUB" -ApiBaseUrl "https://esmenails-api.onrender.com"
```

4. Haz push a `main` (o ejecuta manualmente `Deploy Web (GitHub Pages)`) para reconstruir la web con esa variable.

## Base de datos local (recomendado)

- `server/src/db/database.seed.json`: semilla limpia versionada en Git.
- `server/src/db/database.json`: base local de ejecucion (ignorada por Git).

Comportamiento:

- Si `database.json` no existe, el servidor copia automaticamente `database.seed.json` en el primer arranque.
- Tus datos reales locales ya no se suben por accidente al repositorio.

### Backup en un comando

Para crear respaldo rapido de la base local:

```bash
npm run backup:db
```

Salida:

- `backups/database-backup-YYYYMMDD-HHMMSS.json`
- `backups/database-backup-latest.json`

## Documentos legales para clientes

La app incluye accesos directos desde `Privacidad y seguridad` a:

- `public/legal/terms.html`
- `public/legal/privacy.html`

Puedes personalizar estos textos con tus condiciones comerciales y legales finales antes de vender.
