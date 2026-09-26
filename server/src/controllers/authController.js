import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { sign, createSession } from "../utils/authTokens.js";

export async function register(req,res,next){
  try{
    const { name, email, password } = req.body;
    if(!name||!email||!password) return res.status(400).json({ success:false, message:"name, email, password required" });
    if(password.length < 6) return res.status(400).json({ success:false, message:"Password must be at least 6 characters" });
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success:false, message:"Invalid email" });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if(exists) return res.status(400).json({ success:false, message:"Email already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase(), password: hash });
    const jti = crypto.randomUUID();
    const token = sign(user, jti);
    await createSession(user, req, jti);
    res.status(201).json({ success:true, data:{ token, user:{ _id:user._id, name:user.name, email:user.email } } });
  }catch(e){ next(e); }
}

export async function login(req,res,next){
  try{
    const { email, password } = req.body;
    if(!email||!password) return res.status(400).json({ success:false, message:"email and password required" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if(!user) return res.status(401).json({ success:false, message:"Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(401).json({ success:false, message:"Invalid credentials" });
    const jti = crypto.randomUUID();
    const token = sign(user, jti);
    await createSession(user, req, jti);
    res.json({ success:true, data:{ token, user:{ _id:user._id, name:user.name, email:user.email } } });
  }catch(e){ next(e); }
}

export async function me(req,res,next){
  try{
    if(!req.user) return res.status(401).json({ success:false, message:"Unauthorized" });
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success:true, data:user });
  }catch(e){ next(e); }
}

export async function updateMe(req,res,next){
  try{
    if(!req.user) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { name, email } = req.body;
    if(!name || !name.trim()) return res.status(400).json({ success:false, message:"Name is required" });
    if(!email || !email.trim()) return res.status(400).json({ success:false, message:"Email is required" });
    const emailLower = email.toLowerCase().trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) return res.status(400).json({ success:false, message:"Invalid email" });
    const existing = await User.findOne({ email: emailLower, _id: { $ne: req.user._id } });
    if(existing) return res.status(400).json({ success:false, message:"Email already in use" });
    const user = await User.findByIdAndUpdate(req.user._id, { name: name.trim(), email: emailLower }, { new:true, runValidators:true }).select("-password");
    if(!user) return res.status(404).json({ success:false, message:"User not found" });
    // keep same jti so session stays valid; do NOT create new session
    const token = sign(user, req.user.jti);
    // update session lastActive to reflect profile update
    if(req.user.jti){
      await Session.updateOne({ jti: req.user.jti }, { lastActiveAt: new Date() }).catch(()=>{});
    }
    res.json({ success:true, data:{ user, token } });
  }catch(e){ next(e); }
}

export async function changePassword(req,res,next){
  try{
    if(!req.user) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { currentPassword, newPassword } = req.body;
    if(!currentPassword || !newPassword) return res.status(400).json({ success:false, message:"Current and new password required" });
    if(newPassword.length < 6) return res.status(400).json({ success:false, message:"New password must be at least 6 characters" });
    const user = await User.findById(req.user._id);
    if(!user) return res.status(404).json({ success:false, message:"User not found" });
    const ok = await bcrypt.compare(currentPassword, user.password);
    if(!ok) return res.status(400).json({ success:false, message:"Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    // revoke all other sessions for security, keep current
    if(req.user.jti){
      await Session.deleteMany({ user: user._id, jti: { $ne: req.user.jti } }).catch(()=>{});
    }
    res.json({ success:true, message:"Password updated successfully. Other devices have been signed out." });
  }catch(e){ next(e); }
}

// Sessions
export async function getSessions(req,res,next){
  try{
    if(!req.user) return res.status(401).json({ success:false, message:"Unauthorized" });
    const sessions = await Session.find({ user: req.user._id }).sort({ lastActiveAt: -1, createdAt: -1 }).lean();
    const currentJti = req.user.jti;
    const now = Date.now();
    const data = sessions.map(s=>({
      _id: s._id,
      jti: s.jti,
      device: s.device,
      browser: s.browser,
      os: s.os,
      isMobile: s.isMobile,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      expiresAt: s.expiresAt,
      isCurrent: currentJti ? s.jti === currentJti : false,
      isExpired: new Date(s.expiresAt).getTime() < now,
    }));
    res.json({ success:true, data });
  }catch(e){ next(e); }
}

export async function revokeSession(req,res,next){
  try{
    if(!req.user) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { id } = req.params;
    const sess = await Session.findOne({ _id: id, user: req.user._id });
    if(!sess) return res.status(404).json({ success:false, message:"Session not found" });
    if(req.user.jti && sess.jti === req.user.jti){
      return res.status(400).json({ success:false, message:"Cannot revoke current session. Use Log out instead." });
    }
    await sess.deleteOne();
    res.json({ success:true, message:"Session revoked" });
  }catch(e){ next(e); }
}

export async function revokeAllSessions(req,res,next){
  try{
    if(!req.user) return res.status(401).json({ success:false, message:"Unauthorized" });
    const all = req.query.all === "true";
    if(all){
      await Session.deleteMany({ user: req.user._id });
    }else{
      if(!req.user.jti) return res.status(400).json({ success:false, message:"No current session" });
      await Session.deleteMany({ user: req.user._id, jti: { $ne: req.user.jti } });
    }
    res.json({ success:true, message: all ? "All sessions revoked" : "Other sessions revoked" });
  }catch(e){ next(e); }
}

export async function logoutCurrent(req,res,next){
  try{
    if(!req.user?.jti) return res.status(400).json({ success:false, message:"No session" });
    await Session.deleteOne({ jti: req.user.jti, user: req.user._id });
    res.json({ success:true, message:"Logged out" });
  }catch(e){ next(e); }
}
