# Personal Workspace V0.1.2

Organizador personal PWA construido con React + Cloudflare Workers + D1 + Workers KV + Gemini API opcional (Interactions API).

## Qué incluye
- Acceso privado de un solo propietario (sin registro de usuarios).
- Dashboard, Mi día, tareas, pipeline Kanban, proyectos y calendario.
- Focus con registro de tiempo.
- Carga directa de archivos a Workers KV (máximo configurado: 20 MB por archivo).
- Bitácora de actividad y métricas básicas.
- PWA instalable en celular/laptop.
- Endpoint opcional para Gemini.

## Configuración Cloudflare ya incluida
Esta carpeta ya contiene los IDs que se crearon en Cloudflare:

- D1 binding `DB` → `personal-workspace-db`
  - Database ID: `cc6c4974-2280-4247-9627-705d08512ebf`
- KV binding `FILES` → `personal-workspace-files`
  - Namespace ID: `d44b29d81fe9441484579dcddbddc85f`
- Gemini model: `gemini-3.8-flash`

**No vuelvas a crear D1 ni KV.** Ya están configurados en `wrangler.jsonc`.

## Base de datos
La migración `migrations/0001_initial.sql` ya fue ejecutada en la D1 remota. Las tablas esperadas son:

- `projects`
- `tasks`
- `attachments`
- `focus_sessions`
- `activity_log`
- `settings`

## Secretos que todavía debes crear en Cloudflare
No se incluyen en GitHub ni en esta carpeta por seguridad:

- `APP_PASSWORD` → contraseña con la que entrarás a la app.
- `SESSION_SECRET` → cadena aleatoria larga (idealmente 32+ caracteres).
- `GEMINI_API_KEY` → tu clave de Gemini API.

Agrégalos como **Secrets** en el Worker `personal-workspace`.

## Desarrollo local opcional
Instala Node.js y ejecuta:

```bash
npm install
npm run dev
```

Para desarrollo local, copia `.dev.vars.example` a `.dev.vars` y agrega ahí los secretos. `.dev.vars` está ignorado por Git.

## Build y despliegue
Cloudflare debe usar:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

También puedes desplegar manualmente con:

```bash
npm run deploy
```

## Correcciones incluidas en V0.1.1
- Se agregó `src/vite-env.d.ts` para los tipos de Vite (`import.meta.env` y CSS).
- Se corrigió `useRef` del temporizador Focus para React 19 / TypeScript actual.
- Se eliminaron archivos `*.tsbuildinfo` del repositorio y se agregaron al `.gitignore`.
- Se fijaron versiones de dependencias para evitar que `latest` cambie el build de forma inesperada.
- Se conservaron los IDs reales de D1 y KV en `wrangler.jsonc`.

## Seguridad
- Nunca subas `APP_PASSWORD`, `SESSION_SECRET` ni `GEMINI_API_KEY` a GitHub.
- Los IDs de D1 y KV no son secretos y sí pueden permanecer en `wrangler.jsonc`.
- Los archivos se sirven a través de la API autenticada.
- Gemini solo recibe el texto enviado explícitamente desde la función de IA.


## Cambios incluidos en V0.1.2

- Focus inicia visualmente en `00:00:00` al confirmar el inicio, sin heredar segundos de diferencia entre cliente y servidor.
- Focus muestra historial de sesiones, duración, tarea relacionada y resumen del día.
- Las sesiones Focus vinculadas a una tarea actualizan su tiempo real acumulado.
- Los archivos pueden vincularse directamente a una tarea o a un proyecto.
- Al editar una tarea se pueden subir, abrir y eliminar sus archivos adjuntos.
- La vista global Archivos funciona como biblioteca central y permite elegir el proyecto/tarea antes de subir.
- Las tareas muestran un indicador de cantidad de archivos adjuntos.
