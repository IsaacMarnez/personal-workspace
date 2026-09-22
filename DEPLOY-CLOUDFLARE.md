# Despliegue rápido · Personal Workspace V0.1.1

## 1. Sustituye los archivos del repositorio
Sube el contenido de esta carpeta a `IsaacMarnez/personal-workspace` reemplazando la versión anterior.

## 2. No vuelvas a crear D1 ni KV
`wrangler.jsonc` ya contiene:

- D1 `personal-workspace-db` → `cc6c4974-2280-4247-9627-705d08512ebf`
- KV `personal-workspace-files` → `d44b29d81fe9441484579dcddbddc85f`

La migración inicial de D1 ya fue ejecutada.

## 3. Build de Cloudflare
Usa:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

## 4. Después de que el build sea exitoso
En el Worker `personal-workspace`, agrega como **Secrets**:

- `APP_PASSWORD`
- `SESSION_SECRET`
- `GEMINI_API_KEY`

No pongas esos valores en GitHub.

## 5. Gemini
El proyecto está configurado para `gemini-3.8-flash` mediante `GEMINI_MODEL` en `wrangler.jsonc`.
