import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import logger from "./utils/logger.js";

import { connectDatabase } from "./config/database.js";
import { validateEnv } from "./config/env.js";
import productRoutes from "./routes/productRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import optionsRoutes from "./routes/optionsRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import { authOptional } from "./middleware/auth.js";
import { configureCloudinary } from "./config/cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load env from server/.env regardless of cwd (concurrently runs from root vs workspace)
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config(); // fallback to root .env / process cwd
let env;
try { env = validateEnv(); } catch(e){
  logger.error("Env validation failed:", e.message);
  if(process.env.NODE_ENV==="production") process.exit(1);
}

configureCloudinary();

const app = express();
app.set("trust proxy", 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS whitelist
const allowed = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map(s=> s.trim());
app.use(cors({
  origin: (origin, cb)=>{
    if(!origin) return cb(null, true);
    if(allowed.includes(origin) || allowed.includes("*")) return cb(null, true);
    // allow Vercel preview etc if needed
    return cb(null, true);
  },
  credentials: true
}));

app.use(compression());
app.use(morgan(env?.isProd ? "combined" : "dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
// Express 5: req.query is getter-only, express-mongo-sanitize tries to set it and crashes.
// Use safe sanitizer that only touches body/params.
app.use((req,res,next)=>{
  const sanitize = (obj)=>{
    if(!obj || typeof obj !== "object") return;
    for(const k of Object.keys(obj)){
      if(k.startsWith("$") || k.includes(".")){
        const v = obj[k];
        delete obj[k];
        obj[k.replace(/^\$|\./g,"_")] = v;
      }
      if(typeof obj[k] === "object") sanitize(obj[k]);
    }
  };
  if(req.body) sanitize(req.body);
  if(req.params) sanitize(req.params);
  next();
});
app.use(hpp());

// Rate limit — increased for dashboard polling + dev StrictMode double-invoke
const limiter = rateLimit({
  windowMs: 15*60*1000,
  max: process.env.NODE_ENV==="production" ? 1000 : 5000,
  standardHeaders:true,
  legacyHeaders:false,
  message: { success:false, message:"Too many requests, please slow down" },
  skip: (req)=> req.path==="/health" || req.path==="/api/health",
});
app.use("/api", limiter);
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 50, message: { success:false, message:"Too many attempts, try later"} });
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
// pairing codes are short-lived but guessable by design — keep the ceiling tight
const pairingLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, message: { success:false, message:"Too many pairing attempts, try later"} });
app.use("/api/auth/pairing/claim", pairingLimiter);
app.use("/api/auth/pairing/ticket/info", pairingLimiter);
app.use("/api/auth/pairing/ticket/authorize", pairingLimiter);
const pairingIssueLimiter = rateLimit({ windowMs: 15*60*1000, max: 40, message: { success:false, message:"Too many pairing requests, try later"} });
app.use("/api/auth/pairing/code", pairingIssueLimiter);
app.use("/api/auth/pairing/ticket", pairingIssueLimiter);

app.use(authOptional);

// Auto-connect database in serverless/on-demand requests
app.use(async (req, res, next) => {
  if (req.path === "/health" || req.path === "/api/health") {
    return next();
  }
  try {
    if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
      await connectDatabase();
    }
    next();
  } catch (err) {
    logger.error(`Database connection failed on request ${req.method} ${req.path}: ${err.message}`);
    res.status(503).json({
      success: false,
      message: "Database connection failed. Please ensure MONGODB_URI is correctly configured in your environment variables.",
    });
  }
});

// Health with DB check
app.get("/api/health", async (req, res) => {
  if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
    try {
      await connectDatabase();
    } catch {}
  }
  const dbState = mongoose.connection.readyState; // 1 connected
  const dbOk = dbState === 1;
  res.status(dbOk ? 200 : 503).json({
    success: dbOk,
    message: dbOk ? "API is running" : "DB not connected",
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    db: dbOk ? "connected" : "disconnected",
    env: process.env.VERCEL ? "vercel-production" : process.env.NODE_ENV || "development",
    platform: process.env.VERCEL ? "vercel-serverless" : "node-server"
  });
});
app.get("/health", (req,res)=> res.redirect("/api/health"));

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/options", optionsRoutes);
app.use("/api/ai", aiRoutes);

// Serve client in production (single deployment)
const rootDist = path.join(__dirname, "../../dist");
const clientSubDist = path.join(__dirname, "../../client/dist");
const clientDist = path.join(__dirname, "../../dist");
app.use(express.static(clientDist));
app.use(express.static(clientSubDist));
app.get("/{*any}", (req,res,next)=>{
  if(req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err)=>{
    if(err) {
      res.sendFile(path.join(clientSubDist, "index.html"), (err2) => {
        if(err2) next();
      });
    }
  });
});

// 404 for API
app.use("/api", (req,res)=>{
  res.status(404).json({ success:false, message:"API route not found" });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error(`[${new Date().toISOString()}] ${error.message}`, { stack: error.stack });
  let status = error.status || 500;
  let message = error.message || "Something went wrong";
  if(error.name === "ValidationError") { status = 400; message = Object.values(error.errors||{}).map(e=>e.message).join(", ") || message; }
  if(error.code === 11000) { status = 400; const field = Object.keys(error.keyValue||{})[0]||"field"; message = `${field} already exists`; }
  if(error.name === "CastError" || error.name === "BSONError") { status = 400; message = "Invalid id format"; }
  if(error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") { status = 401; message = "Invalid token"; }
  // hide stack in prod
  const payload = { success: false, message };
  if(process.env.NODE_ENV !== "production" && error.stack) payload.stack = error.stack;
  res.status(status).json(payload);
});

const PORT = process.env.PORT || 5000;
let server;

// Only start HTTP listener if running standalone (not in Vercel Serverless environment)
if (!process.env.VERCEL && !process.env.NOW_REGION) {
  connectDatabase()
    .then(() => {
      server = app.listen(PORT, () => logger.info(`API running on port ${PORT} [${process.env.NODE_ENV||"development"}]`));
    })
    .catch((error) => {
      logger.error("Startup failed:", error);
      process.exit(1);
    });

  // Graceful shutdown for standalone server
  function shutdown(signal){
    logger.info(`Received ${signal}, shutting down gracefully`);
    if(server) server.close(()=> {
      mongoose.connection.close(false).then(()=> {
        logger.info("Closed out remaining connections");
        process.exit(0);
      });
    });
    setTimeout(()=> process.exit(1), 10000).unref();
  }
  process.on("SIGTERM", ()=> shutdown("SIGTERM"));
  process.on("SIGINT", ()=> shutdown("SIGINT"));
}

process.on("unhandledRejection", (err)=>{ logger.error("Unhandled Rejection:", err); });
process.on("uncaughtException", (err)=>{ logger.error("Uncaught Exception:", err); if(!process.env.VERCEL) process.exit(1); });

export default app;
