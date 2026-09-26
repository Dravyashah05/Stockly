import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "./models/Category.js";
import Product from "./models/Product.js";
import BOM from "./models/BOM.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

async function seed(){
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected");

  await Category.deleteMany({});
  await Product.deleteMany({});
  await BOM.deleteMany({});

  const cats = await Category.insertMany([
    { name:"Raw Materials", description:"Wood, screws, paint etc.", status:"active" },
    { name:"Finished Products", description:"Chairs, tables etc.", status:"active" },
    { name:"Consumables", description:"Glue, varnish", status:"active" },
  ]);
  const rawCat = cats[0]._id;
  const finCat = cats[1]._id;

  const wood = await Product.create({ name:"Wood Plank", sku:"WOOD-001", category: rawCat, description:"Premium pine wood plank", quantity:100, unit:"pcs", minimumStock:20, image:"" });
  const screws = await Product.create({ name:"Screws", sku:"SCRW-001", category: rawCat, description:"Steel screws 3cm", quantity:500, unit:"pcs", minimumStock:100 });
  const paint = await Product.create({ name:"Paint", sku:"PAINT-001", category: rawCat, description:"Wood paint 1L", quantity:20, unit:"liters", minimumStock:5 });
  const chair = await Product.create({ name:"Wooden Chair", sku:"CHAIR-001", category: finCat, description:"Handmade wooden chair", quantity:5, unit:"pcs", minimumStock:2 });
  const table = await Product.create({ name:"Wooden Table", sku:"TABLE-001", category: finCat, description:"4-seater wooden table", quantity:2, unit:"pcs", minimumStock:1 });

  await BOM.create({
    product: chair._id,
    productId: chair._id,
    materials: [
      { product: wood._id, productId: wood._id, quantity:3 },
      { product: screws._id, productId: screws._id, quantity:12 },
      { product: paint._id, productId: paint._id, quantity:0.5 }
    ]
  });
  await BOM.create({
    product: table._id,
    productId: table._id,
    materials: [
      { product: wood._id, productId: wood._id, quantity:5 },
      { product: screws._id, productId: screws._id, quantity:20 },
      { product: paint._id, productId: paint._id, quantity:1 }
    ]
  });

  const exists = await User.findOne({ email:"admin@stockly.com" });
  if(!exists){
    const hash = await bcrypt.hash("admin123",10);
    await User.create({ name:"Admin", email:"admin@stockly.com", password:hash });
    console.log("User created: admin@stockly.com / admin123");
  }

  console.log("Seed done:");
  console.log({ categories: cats.length, products: 5, boms:2 });
  await mongoose.disconnect();
}
seed().catch(e=>{ console.error(e); process.exit(1); });
