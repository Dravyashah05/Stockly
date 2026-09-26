import express from "express";
import {
  stockIn, stockOut, getStockHistory, getRecentTransactions, updateStockTransaction, deleteStockTransaction
} from "../controllers/stockController.js";
import { authRequired, authOptional } from "../middleware/auth.js";
import { validateStock, validateIdParam, validatePagination } from "../middleware/validate.js";

const router = express.Router();
router.post("/in", authRequired, validateStock, stockIn);
router.post("/out", authRequired, validateStock, stockOut);
router.get("/history", authOptional, validatePagination, getStockHistory);
router.get("/history/:productId", authOptional, getStockHistory);
router.get("/recent", authOptional, getRecentTransactions);
router.put("/:id", authRequired, validateIdParam, updateStockTransaction);
router.delete("/:id", authRequired, validateIdParam, deleteStockTransaction);

export default router;