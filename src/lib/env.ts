import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  BETTER_AUTH_SECRET: z.string(),
  /** Public URL of this API. On Render, you can omit this and use RENDER_EXTERNAL_URL instead. */
  API_BASE_URL: z.url().optional(),
  /** Injected by Render (https://…onrender.com). Used when API_BASE_URL is not set. */
  RENDER_EXTERNAL_URL: z.url().optional(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string(),
  WEB_APP_BASE_URL: z.url(),
  /**
   * URLs extras permitidas no CORS / Better Auth (vírgula).
   * Útil para aceitar com e sem www, ex. https://www.front.maiapets.com.br
   */
  WEB_APP_EXTRA_ORIGINS: z.string().optional(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

const parsed = envSchema.parse(process.env);

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function resolveApiBaseUrl(): string {
  const explicit = parsed.API_BASE_URL;
  const render = parsed.RENDER_EXTERNAL_URL;

  if (
    parsed.NODE_ENV === "production" &&
    render &&
    (!explicit || isLocalhostUrl(explicit))
  ) {
    return render;
  }

  return explicit ?? render ?? "http://localhost:8080";
}

const API_BASE_URL = resolveApiBaseUrl();

function webAppAllowedOrigins(): string[] {
  const base = parsed.WEB_APP_BASE_URL;
  const extras: string[] = [];
  for (const raw of parsed.WEB_APP_EXTRA_ORIGINS?.split(",") ?? []) {
    const s = raw.trim();
    if (!s) continue;
    try {
      void new URL(s);
      extras.push(s);
    } catch {
      // skip invalid URL fragments
    }
  }
  return [...new Set([base, ...extras])];
}

const WEB_APP_ALLOWED_ORIGINS = webAppAllowedOrigins();

export const env = {
  ...parsed,
  API_BASE_URL,
  WEB_APP_ALLOWED_ORIGINS,
};
