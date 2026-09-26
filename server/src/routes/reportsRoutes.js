import express from "express";
import { authRequired } from "../middleware/auth.js";
import { dailyStockReport, stockInReport, stockOutReport, lowStockReport, categoryWiseInventory, supplierWisePurchases, productMovement, stockValuation, monthlyInventorySummary } from "../controllers/reportsController.js";
const router = express.Router();

router.get("/daily", authRequired, dailyStockReport);
router.get("/stock-in", authRequired, stockInReport);
router.get("/stock-out", authRequired, stockOutReport);
router.get("/low-stock", authRequired, lowStockReport);
router.get("/category-wise", authRequired, categoryWiseInventory);
router.get("/supplier-wise", authRequired, supplierWisePurchases);
router.get("/product-movement", authRequired, productMovement);
router.get("/valuation", authRequired, stockValuation);
router.get("/monthly", authRequired, monthlyInventorySummary);

export default router;
