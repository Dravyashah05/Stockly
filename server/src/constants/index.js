export const TRANSACTION_TYPES = {
  IN: "IN",
  OUT: "OUT",
};

export const TRANSACTION_TYPE_OPTIONS = Object.values(TRANSACTION_TYPES);

export const CUSTOM_FIELD_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  SELECT: "select",
  DATE: "date",
  CHECKBOX: "checkbox",
};

export const CUSTOM_FIELD_TYPE_OPTIONS = Object.values(CUSTOM_FIELD_TYPES);

export const CATEGORY_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

export const CATEGORY_STATUS_OPTIONS = Object.values(CATEGORY_STATUS);

export const AUDIT_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  STOCK_IN: "stock_in",
  STOCK_OUT: "stock_out",
};

export const AUDIT_ACTION_OPTIONS = Object.values(AUDIT_ACTIONS);

export const AUDIT_ENTITIES = {
  PRODUCT: "product",
  CATEGORY: "category",
  STOCK: "stock",
  USER: "user",
  SUPPLIER: "supplier",
  SESSION: "session",
};

export const AUDIT_ENTITY_OPTIONS = Object.values(AUDIT_ENTITIES);

export const PRODUCT_STATUS = {
  OUT_OF_STOCK: "Out of Stock",
  LOW_STOCK: "Low Stock",
  IN_STOCK: "In Stock",
};

export const PRODUCT_STATUS_OPTIONS = Object.values(PRODUCT_STATUS);

export const DEFAULT_UNIT = "pcs";

export const ALL_OPTIONS = {
  transactionTypes: TRANSACTION_TYPE_OPTIONS,
  customFieldTypes: CUSTOM_FIELD_TYPE_OPTIONS,
  categoryStatus: CATEGORY_STATUS_OPTIONS,
  auditActions: AUDIT_ACTION_OPTIONS,
  auditEntities: AUDIT_ENTITY_OPTIONS,
  productStatus: PRODUCT_STATUS_OPTIONS,
  defaultUnit: DEFAULT_UNIT,
};

export function getAllOptions() {
  return ALL_OPTIONS;
}