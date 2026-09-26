import express from "express";
import { authRequired } from "../middleware/auth.js";
import { getAuditLogs, getEntityHistory } from "../controllers/auditController.js";
const router = express.Router();
router.get("/", authRequired, getAuditLogs);
router.get("/:entity/:id", authRequired, getEntityHistory);
export default router;
