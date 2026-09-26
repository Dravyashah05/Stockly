import AuditLog from "../models/AuditLog.js";

export async function logAudit({ req, action, entity, entityId, before=null, after=null }){
  try{
    const user = req.user;
    if(!user) return;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
    await AuditLog.create({
      user: user._id,
      userName: user.name || "",
      userEmail: user.email || "",
      action,
      entity,
      entityId: entityId || undefined,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      ip,
      userAgent: req.headers["user-agent"] || "",
    });
  }catch(e){
    console.error("audit log failed", e.message);
  }
}
