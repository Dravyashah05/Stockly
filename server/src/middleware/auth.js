import jwt from "jsonwebtoken";
import Session from "../models/Session.js";

function getJwtSecret(){
  const secret = process.env.JWT_SECRET;
  if(!secret || secret === "dev_secret"){
    if(process.env.NODE_ENV === "production"){
      throw new Error("JWT_SECRET not configured");
    }
    return "dev_secret";
  }
  return secret;
}

export function authOptional(req,res,next){
  const header = req.headers.authorization;
  if(header?.startsWith("Bearer ")){
    try{
      const token = header.split(" ")[1];
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = decoded;
    }catch(e){ /* ignore invalid token for optional */ }
  }
  next();
}

export async function authRequired(req,res,next){
  const header = req.headers.authorization;
  if(!header?.startsWith("Bearer ")){
    return res.status(401).json({ success:false, message:"Unauthorized" });
  }
  try{
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret());
    // if token has jti, validate session exists and not expired
    if(decoded.jti){
      const sess = await Session.findOne({ jti: decoded.jti, user: decoded._id }).lean();
      if(!sess){
        return res.status(401).json({ success:false, message:"Session expired. Please log in again." });
      }
      if(new Date(sess.expiresAt).getTime() < Date.now()){
        await Session.deleteOne({ jti: decoded.jti }).catch(()=>{});
        return res.status(401).json({ success:false, message:"Session expired. Please log in again." });
      }
      // bump lastActiveAt asynchronously (fire and forget, throttled to 60s)
      const last = sess.lastActiveAt ? new Date(sess.lastActiveAt).getTime() : 0;
      if(Date.now() - last > 60_000){
        Session.updateOne({ jti: decoded.jti }, { lastActiveAt: new Date() }).catch(()=>{});
      }
    }
    req.user = decoded;
    next();
  }catch(e){
    const msg = e.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ success:false, message: msg });
  }
}
