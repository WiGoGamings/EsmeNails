# EsmeNails

Aplicacion de gestion para salon (agenda, clientes, promociones, puntos, contacto y panel admin).

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
- `npm run desktop:build`: genera instalador Windows (`nsis`) y portable
- `npm run desktop:build:portable`: genera solo version portable
- `npm run desktop:build:installer`: genera solo instalador

Los ejecutables de escritorio se generan en `release/`.

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

## Automatizacion incluida (GitHub Actions)

Este repo ya incluye:

- `.github/workflows/desktop-release.yml`
	- Al subir un tag `v*` (ejemplo `v1.0.1`), compila Windows y adjunta `.exe` automaticamente al Release.
- `.github/workflows/pages.yml`
	- Al hacer push a `main`, compila y publica la web en GitHub Pages.

Para disparar release automatica de escritorio:

```bash
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

## Variables de entorno

Puedes copiar `.env.example` y ajustar valores en `server/.env` segun necesites (correo SMTP, credenciales admin, etc.).

## Base de datos local (recomendado)

- `server/src/db/database.seed.json`: semilla limpia versionada en Git.
- `server/src/db/database.json`: base local de ejecucion (ignorada por Git).

Comportamiento:

- Si `database.json` no existe, el servidor copia automaticamente `database.seed.json` en el primer arranque.
- Tus datos reales locales ya no se suben por accidente al repositorio.
