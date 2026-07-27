import { registerAs } from "@nestjs/config";

/**
 * Database configuration namespace: 'database'
 * PostgreSQL connection settings from environment variables.
 */
export default registerAs("database", () => ({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USERNAME || "seal_user",
  password: process.env.DB_PASSWORD || "seal_password",
  name: process.env.DB_NAME || "seal_dev",
  ssl: process.env.DB_SSL === "true",

  /**
   * synchronize: true — auto-sync entity schema to DB (dev only).
   * NEVER set to true in production without migration strategy.
   */
  synchronize: process.env.NODE_ENV !== "production",

  /** Log SQL queries in development (optional) */
  logging: process.env.DB_LOGGING === "true",
}));
