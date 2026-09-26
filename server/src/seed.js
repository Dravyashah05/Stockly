import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "./models/Category.js";
import Product from "./models/Product.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

async function seed(){
  if(!process.env.MONGODB_URI){
    console.error("MONGODB_URI is required to run seed");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  await Category.deleteMany({});
  await Product.deleteMany({});

  const cats = await Category.insertMany([
    { name:"Raw Materials", description:"Wood, screws, paint etc.", status:"active" },
    { name:"Finished Products", description:"Chairs, tables etc.", status:"active" },
    { name:"Consumables", description:"Glue, varnish", status:"active" },
  ]);
  const rawCat = cats[0]._id;
  const finCat = cats[1]._id;

  await Product.create({ name:"Wood Plank", sku:"WOOD-001", category: rawCat, description:"Premium pine wood plank", quantity:100, unit:"pcs", minimumStock:20, price: 15.5 });
  await Product.create({ name:"Screws", sku:"SCRW-001", category: rawCat, description:"Steel screws 3cm", quantity:500, unit:"pcs", minimumStock:100, price: 0.2 });
  await Product.create({ name:"Paint", sku:"PAINT-001", category: rawCat, description:"Wood paint 1L", quantity:20, unit:"liters", minimumStock:5, price: 25.0 });
  await Product.create({ name:"Wooden Chair", sku:"CHAIR-001", category: finCat, description:"Handmade wooden chair", quantity:5, unit:"pcs", minimumStock:2, price: 85.0 });
  await Product.create({ name:"Wooden Table", sku:"TABLE-001", category: finCat, description:"4-seater wooden table", quantity:2, unit:"pcs", minimumStock:1, price: 190.0 });

  const exists = await User.findOne({ email:"admin@stockly.com" });
  if(!exists){
    const hash = await bcrypt.hash("admin123",10);
    await User.create({ name:"Admin", email:"admin@stockly.com", password:hash });
    console.log("Admin user created: admin@stockly.com / admin123");
  }

  console.log("Seed finished successfully:");
  console.log({ categories: cats.length, products: 5 });
  await mongoose.disconnect();
}
seed().catch(e=>{ console.error(e); process.exit(1); });
