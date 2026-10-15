# `@stockly/admin` — owner-only administration website

Owner login (setup-key + email, short-lived session token), user
management + suspension, spreadsheet connection status, linked-device
management, administrative logs, application settings.

## Source

`src/admin/AdminScreen.tsx` (sections: users, devices, roles, settings,
logs) + `src/shared/` (public clients: `admin-api.ts`, `devices.ts`,
`config.ts`). **Never touches the private admin spreadsheet directly** —
all storage goes through the shared backend's `/api/admin` and
`/api/devices` routes, which enforce owner authorization server-side on
every request.

## Env (public only)

See `.env.example`. Points at the **same shared backend** as the user app
(dev: Vite proxies `/api/*` to `http://localhost:5000`). No secrets, no
spreadsheet credentials — those live in `server/.env`.

## Run

```sh
npm run dev      # inside admin/ → http://localhost:3002 (proxies /api/* to :5000)
npm run build    # web bundle → dist/
```

Backend must be running (`npm run dev` inside `server/`). First-time
setup needs the server setup key (`ADMIN_SETUP_KEY`) via the
"First setup" tab — one-time owner bootstrap only.
