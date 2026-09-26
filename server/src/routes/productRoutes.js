import express from "express";
import multer from "multer";
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  bulkDeleteProducts, bulkUpdateProducts, uploadProductImage
} from "../controllers/productController.js";
import { authRequired, authOptional } from "../middleware/auth.js";
import { validateProduct, validateIdParam, validatePagination } from "../middleware/validate.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

router.get("/", authOptional, validatePagination, getProducts);
router.post("/bulk-delete", authRequired, bulkDeleteProducts);
router.post("/bulk-update", authRequired, bulkUpdateProducts);
router.post("/upload-image", authRequired, upload.single("image"), uploadProductImage);
router.get("/:id", authOptional, validateIdParam, getProduct);
router.post("/", authRequired, validateProduct, createProduct);
router.put("/:id", authRequired, validateIdParam, updateProduct);
router.patch("/:id", authRequired, validateIdParam, updateProduct);
router.delete("/:id", authRequired, validateIdParam, deleteProduct);

export default router;