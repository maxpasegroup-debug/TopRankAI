import { z } from "zod";

// A commented-out or blank key in `.env` arrives as an empty string. Treat it
// as "not set" so an unconfigured optional integration never blocks boot.
const blankAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema,
  ) as unknown as T;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: blankAsUndefined(z.string().min(16).optional()),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GEMINI_API_KEY: blankAsUndefined(z.string().min(10).optional()),
  GEMINI_MODEL: blankAsUndefined(z.string().min(1).default("gemini-3.5-flash")),
  AI_FEATURES_ENABLED: blankAsUndefined(z.string().optional()),
  // Image storage. Cloudinary is the active provider; R2 stays available for
  // production. Every value is optional so the app boots without storage and
  // uploads report that they are not configured.
  STORAGE_PROVIDER: blankAsUndefined(z.enum(["cloudinary", "r2"]).optional()),
  CLOUDINARY_CLOUD_NAME: blankAsUndefined(z.string().min(1).optional()),
  CLOUDINARY_API_KEY: blankAsUndefined(z.string().min(1).optional()),
  CLOUDINARY_API_SECRET: blankAsUndefined(z.string().min(1).optional()),
  // Cloudflare R2 (S3-compatible), optional production alternative.
  R2_ACCOUNT_ID: blankAsUndefined(z.string().min(1).optional()),
  R2_ACCESS_KEY_ID: blankAsUndefined(z.string().min(1).optional()),
  R2_SECRET_ACCESS_KEY: blankAsUndefined(z.string().min(1).optional()),
  R2_BUCKET: blankAsUndefined(z.string().min(1).optional()),
  R2_PUBLIC_BASE_URL: blankAsUndefined(z.string().url().optional()),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return parsed.data;
}

export function aiConfiguration() {
  const env = getEnv();
  const enabled = env.AI_FEATURES_ENABLED !== "false" && Boolean(env.GEMINI_API_KEY);
  return { enabled, hasKey: Boolean(env.GEMINI_API_KEY), provider: "google", model: env.GEMINI_MODEL };
}

/**
 * `pg` warns when it sees `sslmode=require` because v3 of the connection-string
 * parser changes what that value means. We keep the current libpq-compatible
 * behaviour explicitly, which removes the warning without weakening TLS.
 */
export function databaseUrl() {
  const raw = getEnv().DATABASE_URL;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
    if (!url.searchParams.has("uselibpqcompat")) url.searchParams.set("uselibpqcompat", "true");
    return url.toString();
  } catch {
    return raw;
  }
}
