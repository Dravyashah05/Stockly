import app from "../server/src/server.js";
import { connectDatabase } from "../server/src/config/database.js";

// Serverless function handler for Vercel
export default async function handler(req, res) {
  try {
    if (process.env.MONGODB_URI) {
      await connectDatabase();
    }
  } catch (err) {
    console.error("Vercel Serverless MongoDB connection error:", err.message);
  }
  return app(req, res);
}
