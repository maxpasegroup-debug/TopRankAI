import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash"),
  AI_FEATURES_ENABLED: z.string().optional(),
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
