# Security - Rotate leaked secrets before production

The previous `.env.example` and `.env` contained real credentials (`616294131827487`, `EteWNiRwN2CCEuLZ`). **Rotate immediately:**

1. MongoDB Atlas: Database Access → edit `stocktracker002_db_user` → Generate new password → update `MONGODB_URI` in deployment env.
2. Cloudinary: Dashboard → Settings → API Keys → Regenerate `api_secret` → update `CLOUDINARY_API_SECRET`.
3. JWT: Generate strong secret: `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` → set as `JWT_SECRET` (>=32 chars, production fails if missing).
4. Remove `JWT_SECRET=dev_secret` fallback is now fail-fast in production (see `src/config/env.js`).

Never commit `.env`. `.env.example` now contains placeholders only.
