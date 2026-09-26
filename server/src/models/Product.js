import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: [true, "Product name is required"], trim: true, maxlength: 150 },
  sku: { type: String, trim: true, uppercase: true },
  image: { type: String, default: "" },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: [true, "Category is required"] },
  description: { type: String, default: "", maxlength: 2000 },
  quantity: { type: Number, default: 0, min: [0, "Quantity cannot be negative"] },
  unit: { type: String, required: [true, "Unit is required"], trim: true, default: "pcs" },
  minimumStock: { type: Number, default: 5, min: [0, "Minimum stock cannot be negative"] },
  minimumQuantity: { type: Number, default: undefined, min: 0 },
  price: { type: Number, default: 0, min: [0, "Price cannot be negative"] },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

schema.pre("save", function(next){
  if(this.isModified("minimumStock") && this.minimumStock !== undefined){
    this.minimumQuantity = this.minimumStock;
  } else if(this.isModified("minimumQuantity") && this.minimumQuantity !== undefined && this.minimumStock === undefined){
    this.minimumStock = this.minimumQuantity;
  }
  if(this.minimumStock === undefined && this.minimumQuantity !== undefined) this.minimumStock = this.minimumQuantity;
  if(this.minimumQuantity === undefined && this.minimumStock !== undefined) this.minimumQuantity = this.minimumStock;
  next();
});

schema.index({ sku: 1 }, { unique: true, sparse: true });
schema.index({ name: "text", sku: "text", description: "text" });
schema.index({ category: 1 });

schema.virtual("status").get(function(){
  if(this.quantity === 0) return "Out of Stock";
  if(this.quantity <= (this.minimumStock ?? this.minimumQuantity ?? 5)) return "Low Stock";
  return "In Stock";
});
schema.virtual("stockValue").get(function(){
  return (Number(this.quantity)||0) * (Number(this.price)||0);
});
schema.set("toJSON", { virtuals: true });
schema.set("toObject", { virtuals: true });

export default mongoose.model("Product", schema);
