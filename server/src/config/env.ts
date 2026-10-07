import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().positive().default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default('mongodb://localhost:27017/corpverse'),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(100),
  JSON_BODY_LIMIT: z.string().default('2mb'),
  JWT_ACCESS_SECRET: z.string().min(16).default('development_jwt_access_secret_at_least_16_chars'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('development_jwt_refresh_secret_at_least_16_chars'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  EMAIL_SERVICE_TYPE: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().default('CorpVerse <noreply@corpverse.com>'),
  APP_URL: z.string().default('http://localhost:5173'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().positive().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Environment validation failed');
  }

  return result.data;
}

export const env = loadEnv();
