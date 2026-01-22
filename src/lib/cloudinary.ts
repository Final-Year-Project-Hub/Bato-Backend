import { BadRequestException, ErrorCode } from '@/utils/root';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (localFilePath: string) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("File is uploaded on cloudinary",response);
    // User requested to keep file locally as well, so we do NOT delete it here.
    return response;
  } catch (error) {
     fs.unlinkSync(localFilePath)
    console.error("Cloudinary upload failed:", error);
    // If upload fails, we might want to decide whether to keep the local file or not. 
    // For now, we leave it as valid local upload could still be useful.
    throw new BadRequestException("Locally saved temporary file as the upload operation failed ", ErrorCode.BAD_REQUEST);
  }
};

export default cloudinary;
