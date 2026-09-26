import express from "express";
import {
  chatCopilot,
  generateProductDescription,
  getRestockForecast,
  getAiStatus,
} from "../controllers/aiController.js";
import { authRequired } from "../middleware/auth.js";
import { validateAiChat, validateAiDescription } from "../middleware/validate.js";

const router = express.Router();

router.get("/status", getAiStatus);
router.post("/chat", authRequired, validateAiChat, chatCopilot);
router.post("/generate-description", authRequired, validateAiDescription, generateProductDescription);
router.post("/forecast", authRequired, getRestockForecast);

export default router;
