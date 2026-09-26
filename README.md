# Stockly — Stock Management System

Modern inventory management with manufacturing (BOM + Production).

## Stack
- **Frontend:** React 19 + Vite 7 + React Router 7 + Tailwind 3 + Axios + Lucide
- **Backend:** Node.js + Express 5 + Mongoose 8
- **DB:** MongoDB Atlas (transactions)
- **Images:** Cloudinary (URL stored in MongoDB)

## Features
- Dashboard: totals, low/out, today's IN/OUT/production, charts (IN vs OUT 7d, by category), recent tx/production
- Products: CRUD, image upload/preview/replace/remove (Cloudinary URL), SKU unique, search SKU/name, filter category/status, sort, pagination
- Categories: CRUD, delete guard (force if products exist)
- Stock IN/OUT: validated (no negative), previous/new qty, reason/notes, transaction history, atomic
- Stock History: filters product/category/type/date range, search, pagination, colors IN/OUT
- BOM: create/edit/delete, per finished product, at least one material, qty >0
- Production: select finished product, qty, date, notes → calculates raw needs, checks sufficiency, deducts raws (OUT), increases finished (IN), creates Production + transactions atomically
- Production History: list + detail, search, date range
- Auth: JWT, roles Admin/Manager/Staff, protected routes

## Project Structure
```
stock-management/
├── frontend (client)  src/components, pages, layouts, api, context, hooks
└── backend (server)  models, routes, controllers, services, config, middleware
```

## Setup

### 1. Install
```bash
npm install
npm install --workspace client
npm install --workspace server
# or
npm run install:all  # if workspaces
```

### 2. Backend env
Copy `server/.env.example` → `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/stock_management?retryWrites=true&w=majority
CLIENT_URL=http://localhost:5173
JWT_SECRET=strong_random_secret
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

### 3. Frontend env
Copy `client/.env.example` → `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Seed (optional)
```bash
npm run seed --workspace server
# creates Raw/Finished categories, Wood/Screws/Paint/Chair/Table, 2 BOMs, admin@stockly.com / admin123
```

### 5. Run
```bash
npm run dev  # both
# or separately
npm run dev --workspace server  # http://localhost:5000
npm run dev --workspace client  # http://localhost:5173
```

## MongoDB Atlas
- Create cluster → Database Access (user) → Network Access (0.0.0.0/0 or your IP) → Connect → copy URI → paste into MONGODB_URI.
- Must be replica set (Atlas is by default) for transactions.

## Cloudinary
- Create account → Dashboard → copy cloud_name, api_key, api_secret → put in server .env
- Frontend sends image as URL (or data URL preview). For production, implement signed upload: POST to Cloudinary from backend `/api/upload` (configure multer + cloudinary). Current implementation stores URL directly; paste Cloudinary URL in product form or use file picker (data URL).

## API
```
GET    /api/products?search=&category=&stockStatus=&sort=&order=&page=&limit=
POST   /api/products
GET    /api/products/:id
PUT/PATCH /api/products/:id
DELETE /api/products/:id

GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

POST   /api/stock/in   {productId, quantity, reason, notes}
POST   /api/stock/out  {productId, quantity, reason, notes}
GET    /api/stock/history?product=&type=&startDate=&endDate=&search=&category=&page=&limit=
GET    /api/stock/history/:productId
GET    /api/stock/recent

GET    /api/bom
GET    /api/bom/:productId
POST   /api/bom
PUT    /api/bom/:id
DELETE /api/bom/:id

POST   /api/production/recipe  (legacy)
GET    /api/production/recipe/:productId
POST   /api/production  {productId, quantity, notes, productionDate}
GET    /api/production?search=&startDate=&endDate=&page=&limit=
GET    /api/production/:id

GET    /api/dashboard

POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
```

## Production Flow (tested)
Create Category → Create Raw Materials (Wood, Screws) → Create Finished (Chair) → Create BOM (Chair: Wood 3, Screws 12) → Add Raw Stock via Stock IN → Production (Chair x10) → Raw deducted (30,120) → Chair +10 → History + Dashboard updated.

## Build
```bash
npm run build --workspace client
```

## Notes
- All quantity changes are atomic via mongoose `startSession` + transaction.
- Vite config uses `@vitejs/plugin-react` with automatic JSX transform (no `React is not defined`).
- Never commit `.env`.
