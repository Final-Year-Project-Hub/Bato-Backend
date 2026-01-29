import cloudinary from "../lib/cloudinary";
import streamifier from "streamifier";

export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder = "avatars"
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};
