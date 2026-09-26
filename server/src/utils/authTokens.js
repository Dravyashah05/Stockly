import jwt from "jsonwebtoken";
import Session from "../models/Session.js";

export const SESSION_TTL_DAYS = 7;

export function getJwtSecret(){
  const s = process.env.JWT_SECRET;
  if(!s || s === "dev_secret"){
    if(process.env.NODE_ENV === "production") throw new Error("JWT_SECRET not configured");
    return "dev_secret";
  }
  return s;
}

export function sign(user, jti){
  const payload = { _id:user._id, email:user.email, name:user.name };
  if(jti) payload.jti = jti;
  return jwt.sign(payload, getJwtSecret(), { expiresIn:`${SESSION_TTL_DAYS}d` });
}

export function parseDevice(ua=""){
  let browser="Unknown";
  if(ua.includes("Edg/")||ua.includes("Edg ")) browser="Edge";
  else if(ua.includes("OPR/")||ua.includes("Opera")) browser="Opera";
  else if(ua.includes("Chrome/")) browser="Chrome";
  else if(ua.includes("Safari") && !ua.includes("Chrome")) browser="Safari";
  else if(ua.includes("Firefox/")) browser="Firefox";

  let os="Unknown";
  if(ua.includes("Windows NT")) os="Windows";
  else if(ua.includes("Mac OS X")) os="macOS";
  else if(ua.includes("Android")) os="Android";
  else if(ua.includes("iPhone")||ua.includes("iPad")) os="iOS";
  else if(ua.includes("Linux")) os="Linux";

  const isMobile = /Mobi|Android|iPhone|iPad/.test(ua);
  const device = `${browser} on ${os}${isMobile ? " • Mobile" : ""}`;
  return { browser, os, isMobile, device };
}

export function getClientIp(req){
  const xff = req.headers["x-forwarded-for"];
  if(typeof xff === "string" && xff.length){
    return xff.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "";
}

export async function createSession(user, req, jti){
  const ua = req.headers["user-agent"] || "";
  const { device, browser, os, isMobile } = parseDevice(ua);
  const ip = getClientIp(req);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS*24*60*60*1000);
  try{
    await Session.create({
      user: user._id,
      jti,
      userAgent: ua,
      ip,
      device,
      browser,
      os,
      isMobile,
      expiresAt,
      lastActiveAt: new Date(),
    });
  }catch(e){
    // ignore duplicate / race
    if(e.code !== 11000) console.error("createSession error", e);
  }
  return expiresAt;
}
