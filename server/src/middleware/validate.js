import { body, param, query, validationResult } from "express-validator";
import mongoose from "mongoose";

export function handleValidation(req,res,next){
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    return res.status(400).json({ success:false, message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
}

export function isObjectId(value){
  return mongoose.Types.ObjectId.isValid(value);
}

export const validateRegister = [
  body("name").trim().isLength({min:2, max:50}).withMessage("Name must be 2-50 chars"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").isLength({min:6, max:128}).withMessage("Password 6-128 chars"),
  handleValidation
];

export const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password required"),
  handleValidation
];

export const validateProduct = [
  body("name").trim().isLength({min:1, max:100}).withMessage("Name required 1-100"),
  body("category").custom(v=> isObjectId(v)).withMessage("Valid category required"),
  body("unit").trim().notEmpty().withMessage("Unit required"),
  body("quantity").optional().isFloat({min:0}).withMessage("Quantity >=0"),
  body("minimumStock").optional().isFloat({min:0}).withMessage("minimumStock >=0"),
  handleValidation
];

export const validateStock = [
  body("productId").custom(v=> isObjectId(v)).withMessage("Valid productId required"),
  body("quantity").isFloat({gt:0}).withMessage("Quantity must be >0"),
  body("reason").optional().trim().isLength({max:100}).withMessage("Reason too long"),
  handleValidation
];

export const validateIdParam = [
  param("id").custom(v=> isObjectId(v)).withMessage("Invalid id"),
  handleValidation
];

export const validatePagination = [
  query("page").optional().isInt({min:1}).toInt(),
  query("limit").optional().isInt({min:1, max:100}).toInt(),
  query("type").optional().isIn(["IN","OUT"]).withMessage("Type must be IN or OUT"),
  handleValidation
];
