import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection;
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongooseInstance) => {
      console.log("MongoDB connected successfully");
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error("MongoDB connection error:", e.message);
    throw e;
  }

  return cached.conn;
}