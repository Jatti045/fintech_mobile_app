import cloudinary from "../config/cloudinary";
import { Request, Response, NextFunction } from "express";
import { Readable } from "stream";

// Utility function to upload buffer to Cloudinary
export const uploadToCloudinary = async (
  buffer: Buffer,
  originalname: string,
  folder: string = "profile-pictures"
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
        public_id: `${folder}/${Date.now()}-${originalname.split(".")[0]}`,
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error("Cloudinary upload failed: No result returned"));
        }
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    const stream = Readable.from(buffer);
    stream.pipe(uploadStream);
  });
};

// Utility function to delete image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Failed to delete image from Cloudinary:", error);
    // Don't throw error as this is cleanup operation
  }
};
