# Stockly — Next-Gen Inventory Management & Warehouse OS

<div align="center">

![Stockly Banner](https://img.shields.io/badge/Stockly-v2.4.0-7c3aed?style=for-the-badge&logo=package&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Vite 7](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Opencode AI](https://img.shields.io/badge/Opencode-AI_Live-8b5cf6?style=for-the-badge&logo=openai&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)

**A high-performance, mobile-first inventory management application and warehouse operating system with live AI Copilot intelligence, multi-device QR pairing, real-time stock ledgers, and automated reporting.**

[Key Features](#-key-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start-local-development) • [Deployment Guide](#-production-deployment-guides) • [API Reference](#-api-reference) • [Security](#-security--environment-variables)

</div>

---

## 🚀 Key Features

### 📱 1. Mobile-First Native App Experience
* **Native App Shell**: Bottom dock navigation, gesture-friendly action sheets, and tactile touch targets designed specifically for warehouse mobile scanners and tablets.
* **Responsive Product List & Cards**: Mobile card-based layout featuring rich product thumbnails, SKU badges with 1-tap copy, price formatting, stock status indicators, and consolidated 3-dot dropdown action menus.
* **Collapsible Desktop Sidebar**: Smooth show/hide drawer with persistence (`localStorage`) and instant keyboard toggle (<kbd>Ctrl+B</kbd> / <kbd>⌘+B</kbd>).
* **Dark / Light Theme Engine**: Adaptive high-contrast design system optimized for warehouse environments and OLED mobile screens.

### 🤖 2. Opencode AI Warehouse Intelligence
* **Live-Context AI Copilot (<kbd>Ctrl+K</kbd>)**: Slide-over assistant with real-time access to live MongoDB metrics (total valuation, low-stock warnings, catalog units, and recent transaction history).
* **Catalog AI Auto-Write**: 1-click product description and specification generator built directly into product creation and editing modals.
* **Restock Runout Forecasting**: Heuristic and LLM-powered demand prediction analyzing turnover velocity to recommend timely purchase orders.
* **Custom Provider Flexibility**: Supports Opencode, OpenRouter, DeepSeek, OpenAI, Groq, and custom endpoints with client-side or server-side API keys.

### 🔐 3. Multi-Device Pairing & QR Login
* **Zero-Password Device Linking**: Link warehouse scanners, tablets, or secondary laptops instantly using short-lived 6-digit numeric pairing codes.
* **Encrypted QR Code Authorization**: Built-in camera scanner with real-time ticket authorization and cryptographic HMAC verification.
* **Active Session Manager**: View connected devices, browsers, operating systems, and IP addresses with one-click remote session revocation.

### 📦 4. Complete Inventory Lifecycle & Stock Control
* **Stock IN & Stock OUT**: Atomic transactions for goods receiving, customer dispatches, waste write-offs, and physical audits with reason tagging.
* **Low Stock Radar**: Proactive threshold alerts highlighting SKUs that dip below minimum safety quantities.
* **Categories & Suppliers**: Complete relational hierarchy for grouping products and tracking vendor contact details.

### 📊 5. Analytics, Audit & Export Engine
* **Interactive KPI Dashboard**: Real-time inventory valuation (₹ / $), 30-day stock turnover velocity, and monthly throughput bar charts.
* **PDF & Excel Reports**: One-click generation of branded PDF inventory ledgers (via `jsPDF-AutoTable`) and ready-to-import Excel spreadsheets (`.xlsx`).
* **Complete Audit Trail**: Immutable log of every inventory adjustment, SKU creation, deletion, and user event.

---

## 🛠️ Tech Stack

```
Stockly Application Architecture
├── Client (React 19 + Vite 7 SPA)
│   ├── UI Framework: React 19, React Router 7, Tailwind CSS 3
│   ├── Icons & Components: Lucide React, Headless UI patterns
│   ├── Data & Export: Axios, jsPDF, jsPDF-AutoTable, XLSX (SheetJS)
│   └── Camera & QR: html5-qrcode, qrcode
│
└── Server (Node.js 20+ & Express 5 REST API)
    ├── Framework: Express 5, Node.js ES Modules
    ├── Database: MongoDB Atlas via Mongoose 8 (Replica Set transactions)
    ├── Security: Helmet, HPP, Express-Rate-Limit, Bcrypt, JWT, Mongo Sanitize
    ├── Cloud Storage: Cloudinary SDK (v2) for product photography
    └── AI Subsystem: OpenCode / OpenRouter OpenAI-Compatible Engine
```

---

## 📂 Project Structure

```
Stockly/
├── client/                     # Frontend Vite SPA
│   ├── public/                 # PWA icons, manifest, robots.txt
│   ├── src/
│   │   ├── api/                # API client modules (products, stock, auth, ai, reports)
│   │   ├── components/         # Reusable UI components (AI drawer, modals, badges, QR)
│   │   ├── context/            # Global React Contexts (Auth, Theme, Search, Toast)
│   │   ├── layouts/            # App Shell layout, collapsible sidebar, bottom nav
│   │   ├── pages/              # Route views (Home, Products, Stock, Dashboard, Settings, etc.)
│   │   ├── index.css           # Tailwind design tokens & animations
│   │   └── main.jsx            # React root entrypoint
│   ├── .env.example            # Client environment template
│   ├── tailwind.config.js      # Tailwind theme configuration
│   └── vite.config.js          # Vite build & proxy settings
│
├── server/                     # Backend Express 5 REST API
│   ├── src/
│   │   ├── config/             # DB connection, Cloudinary, fail-fast env validation
│   │   ├── controllers/        # Route controllers (products, stock, auth, pairing, ai)
│   │   ├── middleware/         # Auth verification, rate limiters, validation
│   │   ├── models/             # Mongoose schemas (Product, StockTransaction, Category, Session)
│   │   ├── routes/             # REST endpoint routers
│   │   ├── services/           # AI service, inventory valuation engine
│   │   ├── utils/              # Token generators, audit loggers, security helpers
│   │   ├── seed.js             # Database seeder script
│   │   └── server.js           # Express app bootstrap & graceful shutdown
│   └── .env.example            # Server environment template
│
├── Dockerfile                  # Production multi-stage Docker container
├── docker-compose.yml          # Local containerized MongoDB + App orchestration
├── package.json                # Root npm workspaces configuration
├── SECURITY.md                 # Security policy and disclosure guidelines
└── README.md                   # Project documentation
```

---

## 💻 Quick Start (Local Development)

### Prerequisites
* **Node.js**: `v18.0.0` or higher (Recommended: `Node.js 20+ LTS`)
* **MongoDB**: A local MongoDB instance or a free [MongoDB Atlas Cluster](https://www.mongodb.com/atlas)
* **npm**: `v9.0.0` or higher

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/stockly.git
cd stockly
```

### 2. Install Dependencies
```bash
npm run install:all
```
*(This installs root, client, and server dependencies using npm workspaces)*

### 3. Setup Environment Variables

**Backend (`server/.env`):**
```bash
cp server/.env.example server/.env
```
Edit `server/.env` and provide your MongoDB connection string and a secure JWT secret:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/stockly_dev
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_development_jwt_secret_must_be_long_enough
```

**Frontend (`client/.env`):**
```bash
cp client/.env.example client/.env
```
```env
VITE_API_URL=http://localhost:5000/api
```

### 4. (Optional) Seed Sample Inventory Data
```bash
npm run seed --workspace server
```
*Creates initial categories (Raw Materials, Finished Products), initial SKUs, and default demo records.*

### 5. Start Development Servers
```bash
npm run dev
```
* Runs the Express API on `http://localhost:5000`
* Runs the Vite Client on `http://localhost:5173`

---

## 🌐 Production Deployment Guides

### Option A: Split Deployment (Vercel Frontend + Render Backend) — Recommended

#### 1. Deploy Backend to Render (or Railway / Fly.io)
1. Push your repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com/) and click **New + Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start`
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or leave default for Render)
   - `MONGODB_URI`: `mongodb+srv://<user>:<pwd>@cluster0.xxx.mongodb.net/stockly`
   - `JWT_SECRET`: *(Generate via `openssl rand -base64 32`)*
   - `CLIENT_URL`: `https://your-stockly-app.vercel.app` *(Your Vercel URL)*
   - `CLOUDINARY_*`: *(Optional: if using Cloudinary)*
   - `OPENCODE_API_KEY`: *(Optional: if using server-side AI key)*
6. Deploy the service and note your backend URL (e.g. `https://stockly-api.onrender.com`).

#### 2. Deploy Frontend to Vercel
1. Log in to [Vercel](https://vercel.com/) and click **Add New Project**.
2. Select your repository.
3. Set the following configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://stockly-api.onrender.com/api`
5. Click **Deploy**.

---

### Option B: Single-Service Monolith Deployment (Render / Railway / VPS)

Stockly includes built-in static serving for `client/dist` from the Express backend, allowing you to host both client and API on a single free or low-cost server instance:

1. In your deployment platform (Render / Railway / Fly.io / VPS):
   - **Root Directory**: `./` (project root)
   - **Build Command**: `npm run install:all && npm run build`
   - **Start Command**: `npm run start`
2. Environment Variables:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://...`
   - `JWT_SECRET`: *(32+ char secret)*
   - `CLIENT_URL`: `https://your-domain.com`
3. The Express server will automatically serve the built SPA for all web routes and API endpoints on `/api/*`.

---

### Option C: Docker & Container Deployment

Stockly includes an optimized multi-stage Docker build:

```bash
# Build the Docker image
docker build -t stockly:latest .

# Run container with environment variables
docker run -d \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWT_SECRET="your_secure_32_char_secret" \
  -e CLIENT_URL="https://yourdomain.com" \
  --name stockly-app stockly:latest
```

Or spin up both application and local MongoDB with Docker Compose:
```bash
docker-compose up -d
```

---

## 🔒 Security & Environment Variables

| Variable | Scope | Required | Description |
|---|---|:---:|---|
| `PORT` | Server | Optional | Port for Express server (Defaults to `5000`). |
| `NODE_ENV` | Server | **Yes** | Set to `production` in live deployments. |
| `MONGODB_URI` | Server | **Yes** | MongoDB connection string (Atlas replica set or local URI). |
| `CLIENT_URL` | Server | **Yes** | Comma-separated list of allowed frontend origins for CORS. |
| `JWT_SECRET` | Server | **Yes** | Cryptographic secret key (>= 32 chars required in production). |
| `CLOUDINARY_CLOUD_NAME` | Server | Optional | Cloudinary cloud account name for product photos. |
| `CLOUDINARY_API_KEY` | Server | Optional | Cloudinary API Key. |
| `CLOUDINARY_API_SECRET` | Server | Optional | Cloudinary API Secret. |
| `OPENCODE_API_KEY` | Server | Optional | Opencode / OpenRouter API Key for Copilot & Auto-Write. |
| `OPENCODE_BASE_URL` | Server | Optional | AI Base URL (Default: `https://api.opencode.ai/v1`). |
| `OPENCODE_MODEL` | Server | Optional | AI Model identifier (Default: `deepseek/deepseek-chat`). |
| `VITE_API_URL` | Client | **Yes** | Base endpoint URL for client requests (e.g. `/api` or full URL). |

---

## 📡 API Reference

### Authentication & Multi-Device Pairing
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Email and password login |
| `GET` | `/api/auth/me` | Fetch active profile |
| `GET` | `/api/auth/sessions` | List active device sessions |
| `DELETE` | `/api/auth/sessions/:id` | Revoke a specific session |
| `POST` | `/api/auth/pairing/code` | Generate 6-digit numeric pairing code |
| `POST` | `/api/auth/pairing/claim` | Claim numeric pairing code from secondary device |
| `POST` | `/api/auth/pairing/ticket` | Issue QR login ticket |
| `POST` | `/api/auth/pairing/ticket/authorize` | Authorize QR ticket from authenticated device |

### Products & Inventory
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Paginated product list with search and filters |
| `POST` | `/api/products` | Create a new inventory SKU |
| `GET` | `/api/products/:id` | Fetch product details and movement history |
| `PATCH` | `/api/products/:id` | Update product information |
| `DELETE` | `/api/products/:id` | Delete product SKU |

### Stock Ledger & Transactions
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/stock/in` | Record Stock IN (Receive inventory) |
| `POST` | `/api/stock/out` | Record Stock OUT (Dispatch inventory) |
| `GET` | `/api/stock/history` | Filterable stock movement history ledger |
| `GET` | `/api/stock/recent` | Recent transactions feed |

### Categories & Suppliers
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/categories` | List active categories |
| `POST` | `/api/categories` | Create a category |
| `GET` | `/api/suppliers` | List active suppliers |
| `POST` | `/api/suppliers` | Register new supplier |

### AI Intelligence
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ai/status` | Verify AI engine connectivity |
| `POST` | `/api/ai/chat` | Chat with Live Inventory AI Copilot |
| `POST` | `/api/ai/generate-description` | AI auto-write catalog description & specs |
| `POST` | `/api/ai/forecast` | Restock runout prediction & demand insights |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

For security policies and vulnerability disclosure, please refer to [SECURITY.md](SECURITY.md).
