import { Redis } from '@upstash/redis';

// Provide fallback values so local dev doesn't crash if env vars are missing
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

export const redis = (url && token) 
  ? new Redis({ url, token }) 
  : null;
