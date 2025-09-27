import "dotenv/config";

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  HOST: process.env.HOST,
  ARCJET_ENV: process.env.ARCJET_ENV,
  ARCJET_KEY: process.env.ARCJET_KEY,
  ARCJET_MODE: process.env.ARCJET_MODE,
  ARCJET_REFILL_RATE: process.env.ARCJET_REFILL_RATE,
  ARCJET_INTERVAL: process.env.ARCJET_INTERVAL,
  ARCJET_CAPACITY: process.env.ARCJET_CAPACITY,
  NODE_ENV: process.env.NODE_ENV,
  // When behind a proxy (Render, Heroku), set TRUST_PROXY to '1' to enable X-Forwarded-* headers
  TRUST_PROXY: process.env.TRUST_PROXY ?? "",
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  // CORS allowed origins, comma separated
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? "*",
};
