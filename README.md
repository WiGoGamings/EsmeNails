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

## Variables de entorno

Puedes copiar `.env.example` y ajustar valores en `server/.env` segun necesites (correo SMTP, credenciales admin, etc.).
