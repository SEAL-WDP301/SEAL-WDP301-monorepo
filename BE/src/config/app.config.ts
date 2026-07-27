import { registerAs } from "@nestjs/config";

/**
 * App configuration namespace: 'app'
 * Typed config loaded from environment variables.
 * Never hardcode values here — always use process.env.
 */
export default registerAs("app", () => ({
  /** Server port */
  port: parseInt(process.env.APP_PORT || "3000", 10),

  /** Node environment */
  nodeEnv: process.env.NODE_ENV || "development",

  /** Global API route prefix */
  prefix: process.env.APP_PREFIX || "api",

  /** Frontend URL for CORS and OAuth redirects */
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3001",

  /** Cookie secret for signed cookies */
  cookieSecret: process.env.COOKIE_SECRET || "cookie_secret",
}));
