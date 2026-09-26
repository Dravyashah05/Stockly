import AuditLog from "../models/AuditLog.js";

export async function getAuditLogs(req,res,next){
  try{
    const { page="1", limit="50", entity, user, action } = req.query;
    const filter={};
    if(entity) filter.entity=entity;
    if(user) filter.user=user;
    if(action) filter.action=action;
    const pg=Math.max(1,parseInt(page)); const lim=Math.min(100,parseInt(limit));
    const total=await AuditLog.countDocuments(filter);
    const logs=await AuditLog.find(filter).populate("user","name email").sort({ createdAt:-1 }).skip((pg-1)*lim).limit(lim).lean();
    res.json({ success:true, data: logs, pagination:{ page:pg, limit:lim, total, pages:Math.ceil(total/lim) } });
  }catch(e){ next(e); }
}

export async function getEntityHistory(req,res,next){
  try{
    const { entity, id } = req.params;
    const logs = await AuditLog.find({ entity, entityId: id }).sort({ createdAt:-1 }).lean();
    res.json({ success:true, data: logs });
  }catch(e){ next(e); }
}
