import dotenv from "dotenv";
dotenv.config();

function requireEnv(name, fallback){
  const val = process.env[name] || fallback;
  if(!val){
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

export function validateEnv(){
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);

  // In production, JWT_SECRET must be set and not default
  const jwtSecret = process.env.JWT_SECRET;
  if(isProd && (!jwtSecret || jwtSecret === "dev_secret" || jwtSecret.length < 32)){
    if(isVercel){
      console.warn("⚠️  JWT_SECRET should be set to a strong random value (>=32 chars) in Vercel Environment Variables");
    } else {
      throw new Error("JWT_SECRET must be set to a strong random value (>=32 chars) in production");
    }
  }
  if(!isProd && !jwtSecret){
    console.warn("⚠️  JWT_SECRET not set, using dev_secret (development only)");
  }

  // MONGODB_URI is required via database.js, but validate here too
  if(!process.env.MONGODB_URI){
    if(isVercel){
      console.warn("⚠️  MONGODB_URI is not set. Please configure MONGODB_URI in Vercel Project Settings.");
    } else {
      throw new Error("MONGODB_URI is required");
    }
  }

  return {
    nodeEnv,
    isProd,
    isVercel,
    port: parseInt(process.env.PORT || "5000", 10),
    clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
    jwtSecret: jwtSecret || "dev_secret",
    mongoUri: process.env.MONGODB_URI,
  };
}
