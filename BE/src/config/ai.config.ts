import { registerAs } from "@nestjs/config";

export default registerAs("ai", () => ({
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  openaiBaseUrl:
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
}));
