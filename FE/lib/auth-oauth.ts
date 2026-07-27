const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

export function getOAuthUrl(provider: "google" | "github") {
  return `${apiBaseUrl.replace(/\/$/, "")}/auth/${provider}`;
}
