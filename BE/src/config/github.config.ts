import { registerAs } from "@nestjs/config";

export default registerAs("github", () => ({
  token: process.env.GITHUB_TOKEN || "",
  org: process.env.GITHUB_ORG || "",
  // Default public: teams must open repo links without org membership.
  // Set GITHUB_REPO_PRIVATE=true only if collaborators are added per team.
  repoPrivate: process.env.GITHUB_REPO_PRIVATE === "true",
  autoInit: process.env.GITHUB_REPO_AUTO_INIT !== "false",
}));
