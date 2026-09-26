import express from "express";
import { getAllOptions } from "../constants/index.js";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json(getAllOptions());
});

export default router;