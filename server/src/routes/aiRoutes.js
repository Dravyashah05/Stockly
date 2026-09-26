import express from "express";
import {
  chatCopilot,
  generateProductDescription,
  getRestockForecast,
  getAiStatus,
} from "../controllers/aiController.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

router.get("/status", getAiStatus);
router.post("/chat", authRequired, chatCopilot);
router.post("/generate-description", authRequired, generateProductDescription);
router.post("/forecast", authRequired, getRestockForecast);

export default router;
