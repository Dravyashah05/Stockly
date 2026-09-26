import { v2 as cloudinary } from "cloudinary";

export function configureCloudinary(){
  if(process.env.CLOUDINARY_CLOUD_NAME){
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
  return cloudinary;
}

export default configureCloudinary;
