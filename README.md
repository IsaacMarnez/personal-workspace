# Personal Workspace V0.1.0

Organizador personal PWA construido con React + Cloudflare Workers + D1 + Workers KV + Gemini API opcional (Interactions API).

## Qué incluye
- Acceso privado de un solo propietario (sin registro de usuarios).
- Dashboard, Mi día, tareas, pipeline Kanban, proyectos y calendario.
- Focus con registro de tiempo.
- Carga directa de archivos a Workers KV (máximo configurado: 20 MB por archivo).
- Bitácora de actividad y métricas básicas.
- PWA instalable en celular/laptop.
- Endpoint opcional para Gemini.

## 1. Requisitos locales
Instala Node.js LTS y Git. Luego:

```bash
npm install
npx wrangler login
```

## 2. Crear D1
```bash
npx wrangler d1 create personal-workspace-db
```
Copia el `database_id` que devuelve y reemplaza `REPLACE_WITH_D1_DATABASE_ID` en `wrangler.jsonc`.

## 3. Crear KV
```bash
npx wrangler kv namespace create PERSONAL_FILES
```
Copia el ID y reemplaza `REPLACE_WITH_KV_NAMESPACE_ID` en `wrangler.jsonc`.

## 4. Aplicar base de datos
```bash
npx wrangler d1 migrations apply personal-workspace-db --remote
```
Acepta la confirmación.

## 5. Secretos
Configura una contraseña privada y un secreto largo para la cookie:

```bash
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Para generar un SESSION_SECRET puedes usar un gestor de contraseñas o cualquier cadena aleatoria larga (idealmente 32+ caracteres).

Gemini es opcional:
```bash
npx wrangler secret put GEMINI_API_KEY
```

## 6. Desarrollo local
Copia `.dev.vars.example` a `.dev.vars` y llena los valores solo para desarrollo local.

```bash
npm run dev
```

## 7. Desplegar
```bash
npm run deploy
```
Wrangler mostrará tu URL `*.workers.dev`.

## 8. GitHub
```bash
git init
git add .
git commit -m "Personal Workspace V0.1.0"
git branch -M main
git remote add origin TU_URL_DEL_REPOSITORIO
git push -u origin main
```

## Notas de seguridad
- `.dev.vars` está ignorado por Git.
- Nunca pongas APP_PASSWORD, SESSION_SECRET ni GEMINI_API_KEY dentro de `wrangler.jsonc` o GitHub.
- Los archivos se sirven únicamente detrás de la sesión privada.
- La IA no lee tus tareas ni archivos automáticamente; solo recibe lo que se envía explícitamente al endpoint de Gemini.
